const fs = require("fs");
const path = require("path");

const csvPath = path.join(__dirname, "../data/ingredient_function_base.csv");
const jsonPath = path.join(__dirname, "../data/ingredient_function_base.json");
const dbCsvPath = path.join(__dirname, "../data/ingredient_db.csv");
const dbJsonPath = path.join(__dirname, "../data/ingredient_db.json");
const aliasCsvPath = path.join(__dirname, "../data/alias_map.csv");
const aliasJsonPath = path.join(__dirname, "../data/alias_map.json");

const csvText = fs.readFileSync(csvPath, "utf-8");

const lines = csvText
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && line.replaceAll(",", "").trim() !== "");

const delimiter = lines[0].includes("\t") ? "\t" : ",";
const headers = lines[0].split(delimiter).map((header) => header.trim());

const ingredients = lines.slice(1).map((line) => {
const values = line.split(delimiter).map((value) => value.trim());

  const row = {};
  headers.forEach((header, index) => {
    row[header] = values[index] ?? "";
  });

  return {
    code: row.code,
    name: row.name_kr,
    salty: Number(row.salty || 0),
    umami: Number(row.umami || 0),
    acid: Number(row.acid || 0),
    sweet: Number(row.sweet || 0),
    bitter: Number(row.bitter || 0),
    heat: Number(row.heat || 0),
    herb: Number(row.herb || 0),
    spice: Number(row.spice || 0),
    lipid: Number(row.lipid || 0),
    texture: Number(row.texture || 0),
    note: row.note || "",
  };
});

fs.writeFileSync(jsonPath, JSON.stringify(ingredients, null, 2), "utf-8");
const dbCsvText = fs.readFileSync(dbCsvPath, "utf-8");

const dbLines = dbCsvText
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && line.replaceAll(",", "").trim() !== "");

const dbDelimiter = dbLines[0].includes("\t") ? "\t" : ",";

const dbHeaders = dbLines[0]
  .split(dbDelimiter)
  .map((header) => header.trim());

const ingredientDb = dbLines.slice(1).map((line) => {
  const values = line.split(dbDelimiter).map((value) => value.trim());

  const row = {};

  dbHeaders.forEach((header, index) => {
    row[header] = values[index] ?? "";
  });

  return row;
});

fs.writeFileSync(
  dbJsonPath,
  JSON.stringify(ingredientDb, null, 2),
  "utf-8"
);

console.log(`Converted ingredient_db.csv to ingredient_db.json`);

console.log(`Converted ${ingredients.length} ingredients to ingredient_function_base.json`);
const aliasCsvText = fs.readFileSync(aliasCsvPath, "utf-8");

const aliasLines = aliasCsvText
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && line.replaceAll(",", "").trim() !== "");

const aliasDelimiter = aliasLines[0].includes("\t") ? "\t" : ",";

const aliasHeaders = aliasLines[0]
  .split(aliasDelimiter)
  .map((header) => header.trim());

const aliasMap = aliasLines.slice(1).map((line) => {
  const values = line.split(aliasDelimiter).map((value) => value.trim());

  const row = {};

  aliasHeaders.forEach((header, index) => {
    row[header] = values[index] ?? "";
  });

  return row;
});

fs.writeFileSync(
  aliasJsonPath,
  JSON.stringify(aliasMap, null, 2),
  "utf-8"
);

console.log(`Converted alias_map.csv to alias_map.json`);