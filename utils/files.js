const fs = require("fs");

function ensureJsonArrayFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf8");
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8") || "[]");

    if (!Array.isArray(parsed)) {
      fs.writeFileSync(filePath, "[]", "utf8");
    }
  } catch (error) {
    fs.writeFileSync(filePath, "[]", "utf8");
  }
}

function readJsonArray(filePath) {
  ensureJsonArrayFile(filePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonArray(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

module.exports = {
  ensureJsonArrayFile,
  readJsonArray,
  writeJsonArray
};