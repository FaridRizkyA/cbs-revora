const fs = require("fs");
const path = require("path");

/**
 * Renders an HTML template with variable replacement
 * @param {string} templateName - The name of the template file (without extension)
 * @param {Object} data - Key-value pairs for replacement
 * @returns {string} The rendered HTML
 */
const renderTemplate = (templateName, data = {}) => {
  const templatesDir = path.join(__dirname, "..", "..", "components", "emails");
  const baseLayoutPath = path.join(templatesDir, "BaseLayout.html");
  const templatePath = path.join(templatesDir, `${templateName}.html`);

  if (!fs.existsSync(baseLayoutPath)) {
    throw new Error("Base email layout not found.");
  }

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template '${templateName}' not found.`);
  }

  let baseLayout = fs.readFileSync(baseLayoutPath, "utf8");
  let templateContent = fs.readFileSync(templatePath, "utf8");

  // Replace variables in the specific template content first
  Object.keys(data).forEach((key) => {
    const placeholder = new RegExp(`{{${key}}}`, "g");
    templateContent = templateContent.replace(placeholder, data[key]);
  });

  // Inject content into base layout
  let finalHtml = baseLayout.replace("{{CONTENT}}", templateContent);

  // Replace global variables in base layout
  finalHtml = finalHtml.replace("{{YEAR}}", new Date().getFullYear());

  return finalHtml;
};

module.exports = { renderTemplate };
