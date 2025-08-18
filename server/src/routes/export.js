// server/src/routes/export.js  (ESM)
import express from "express";
import { pool } from "../db/pool.js";
import ExcelJS from "exceljs";

const router = express.Router();

router.get("/mgr/export", async (req, res) => {
  try {
    // fully-qualify if your view lives in public schema:
    const { rows, fields } = await pool.query(`SELECT * FROM manager_leads_export`);

    // Build workbook
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Leads");

    // Derive columns even if result is empty
    const keys =
      rows.length > 0
        ? Object.keys(rows[0])
        : (fields || []).map((f) => f.name);

    if (!keys.length) {
      // Nothing to export – still return a tiny workbook
      ws.addRow(["No data available"]);
    } else {
      ws.columns = keys.map((k) => ({
        header: k.replace(/_/g, " ").toUpperCase(),
        key: k,
        width: Math.max(12, Math.min(30, (k.length + 4))),
      }));

      // Add data rows (ExcelJS is fine with plain objects)
      for (const row of rows) {
        ws.addRow(row);
      }

      // Optional: make header bold
      ws.getRow(1).font = { bold: true };
    }

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="manager_leads.xlsx"'
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Stream to response
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[/api/mgr/export] failed:", err);
    res.status(500).json({ error: "Failed to export leads" });
  }
});

export default router;