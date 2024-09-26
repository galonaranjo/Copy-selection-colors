figma.showUI(__html__, { width: 240, height: 280 });

// Function to convert RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
}

// Function to convert Alpha (0 to 1) to 2-digit Hex
function alphaToHex(a: number): string {
  const alphaHex = Math.round(a * 255).toString(16);
  return alphaHex.length === 1 ? "0" + alphaHex : alphaHex;
}

// Function to get colors from the selection based on format
function getColors(format: string) {
  const selection = figma.currentPage.selection;
  let colorValues: string[] = [];

  selection.forEach((node) => {
    if ("fills" in node && Array.isArray(node.fills)) {
      const fills = node.fills as Paint[];
      fills.forEach((fill) => {
        if (fill.type === "SOLID") {
          const { r, g, b } = fill.color;
          const opacity = fill.opacity !== undefined ? fill.opacity : 1;
          let colorValue: string;

          switch (format) {
            case "hex":
              colorValue = rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
              if (opacity < 1) {
                colorValue += alphaToHex(opacity);
              }
              break;
            case "rgba":
              // Round the opacity to two decimal places
              const roundedOpacity = Math.round(opacity * 100) / 100;
              colorValue = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(
                b * 255
              )}, ${roundedOpacity})`;
              break;
            default:
              colorValue = "";
          }

          if (colorValue) {
            colorValues.push(colorValue);
          }
        }
      });
    }
  });

  figma.ui.postMessage({ type: "colors-in-format", colorValues });
}

// Listen for selection changes
let currentFormat = "hex"; // Default format

figma.on("selectionchange", () => {
  getColors(currentFormat); // Get colors based on the current format
});

// Function to paste text as a new text node within the selected element
async function pasteTextIntoNode(colorValues: string[]) {
  const selection = figma.currentPage.selection;
  if (selection.length > 0) {
    for (let i = 0; i < selection.length; i++) {
      const selectedNode = selection[i];
      const colorValue = colorValues[i % colorValues.length]; // Cycle through color values if there are more nodes than colors

      // Create a new text node
      const textNode = figma.createText();

      // Load the font before setting the text
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      textNode.fontName = { family: "Inter", style: "Regular" };
      textNode.fontSize = 12;
      textNode.characters = colorValue;

      // Let Figma automatically set the width based on the text content
      textNode.textAutoResize = "WIDTH_AND_HEIGHT";

      // Calculate the absolute position of the selected node
      const absoluteX = selectedNode.absoluteTransform[0][2];
      const absoluteY = selectedNode.absoluteTransform[1][2];

      // Determine the appropriate parent and calculate position adjustment
      let parent: BaseNode & ChildrenMixin = figma.currentPage;
      let xAdjustment = 0;
      let yAdjustment = 0;

      if (selectedNode.parent) {
        parent = selectedNode.parent;
        let currentParent: BaseNode | null = parent;
        while (currentParent && (currentParent.type === "FRAME" || currentParent.type === "GROUP")) {
          if ("x" in currentParent && "y" in currentParent) {
            xAdjustment += currentParent.x;
            yAdjustment += currentParent.y;
          }
          currentParent = currentParent.parent;
        }
      }

      // Now set the position of the text node
      textNode.x = absoluteX - xAdjustment + (selectedNode.width - textNode.width) / 2;
      textNode.y = absoluteY - yAdjustment + selectedNode.height + 24; // 24px below the selected node

      // Add the new text node to the parent
      parent.appendChild(textNode);
    }

    figma.notify(`Color values added below ${selection.length} selected element(s)`);
  } else {
    figma.notify("Please select at least one element to add color values to");
  }
}

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === "set-format") {
    currentFormat = msg.format; // Update current format
    getColors(currentFormat); // Get colors based on the new format
  } else if (msg.type === "paste-text") {
    await pasteTextIntoNode(msg.colorValues);
  }
};
