/**
 * Excel Export Service
 * Generates an .xlsx file for the monthly attendance matrix:
 *   Rows: Employees (filtered by workplace)
 *   Columns: Calendar days of the selected month
 *   Cells: Work status / worked hours
 */

import ExcelJS from "exceljs";
import prisma from "./prisma";
import { getDaysInMonth, isWeekend, formatDate } from "./timezone";
import { formatMinutes } from "./attendance.service";

export interface ExcelExportOptions {
  companyId: string;
  workplaceId?: string;
  year: number;
  month: number;
}

const STATUS_LABELS: Record<string, string> = {
  PRESENT:        "Çalıştı",
  ABSENT:         "Devamsız",
  HALF_DAY:       "Yarım Gün",
  ANNUAL_LEAVE:   "Y.İzin",
  SICK_LEAVE:     "H.İzin",
  EXCUSED:        "Mazeret",
  PUBLIC_HOLIDAY: "Resmi Tatil",
  REST_DAY:       "Tatil",
};

export async function generateMonthlyAttendanceExcel(
  options: ExcelExportOptions
): Promise<Buffer> {
  const { companyId, workplaceId, year, month } = options;

  // Fetch employees
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      ...(workplaceId ? { workplaceId } : {}),
      status: "ACTIVE",
    },
    include: { workplace: true },
    orderBy: [{ workplace: { name: "asc" } }, { lastName: "asc" }],
  });

  // Fetch all AttendanceDay records for the period
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate   = new Date(Date.UTC(year, month, 0));

  const [attendanceDays, publicHolidays] = await Promise.all([
    prisma.attendanceDay.findMany({
      where: {
        employee: { companyId },
        workDate: { gte: startDate, lte: endDate },
        ...(workplaceId ? { employee: { workplaceId } } : {}),
      },
    }),
    prisma.publicHoliday.findMany({
      where: {
        companyId,
        date: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  const holidayMap = new Map<string, (typeof publicHolidays)[0]>();
  for (const h of publicHolidays) {
    holidayMap.set(h.date.toISOString().slice(0, 10), h);
  }

  // Build a lookup map: employeeId → workDate (YYYY-MM-DD) → AttendanceDay
  const dayMap = new Map<string, Map<string, typeof attendanceDays[0]>>();
  for (const day of attendanceDays) {
    if (!dayMap.has(day.employeeId)) dayMap.set(day.employeeId, new Map());
    const dateKey = day.workDate.toISOString().slice(0, 10);
    dayMap.get(day.employeeId)!.set(dateKey, day);
  }

  const days = getDaysInMonth(year, month);
  const monthLabel = `${year}-${String(month).padStart(2, "0")}`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "İK Yönetim Sistemi";
  workbook.created = new Date();

  const ws = workbook.addWorksheet(`Puantaj ${monthLabel}`, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  // ── Define column widths ──────────────────────────────────────────
  const fixedCols = [
    { header: "No",         key: "no",         width: 5  },
    { header: "Sicil No",   key: "empNo",       width: 10 },
    { header: "Ad Soyad",   key: "name",        width: 22 },
    { header: "Görev Yeri", key: "workplace",   width: 18 },
  ];

  const dayCols = days.map((d) => ({
    header: String(d.getUTCDate()),
    key:    `d_${d.getUTCDate()}`,
    width:  5,
  }));

  const summaryCols = [
    { header: "Toplam Gün",  key: "totalDays",    width: 12 },
    { header: "Toplam Saat", key: "totalHours",   width: 12 },
    { header: "Fazla Mesai", key: "overtime",     width: 12 },
  ];

  ws.columns = [...fixedCols, ...dayCols, ...summaryCols] as ExcelJS.Column[];

  // ── Style helpers ─────────────────────────────────────────────────
  const headerFill: ExcelJS.Fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" },
  };
  const weekendFill: ExcelJS.Fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3748" },
  };
  const presentFill: ExcelJS.Fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FF1A4731" },
  };
  const absentFill: ExcelJS.Fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FF4A1515" },
  };
  const leaveFill: ExcelJS.Fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3300" },
  };

  // ── Title row ─────────────────────────────────────────────────────
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const totalCols = fixedCols.length + days.length + summaryCols.length;

  const titleRow = ws.addRow([`${company?.name ?? ""} — Aylık Puantaj Tablosu — ${year} / ${month}`]);
  ws.mergeCells(1, 1, 1, totalCols);
  titleRow.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleRow.fill = headerFill;
  titleRow.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 28;

  // ── Header row ───────────────────────────────────────────────────
  const headerRow = ws.addRow([
    "No", "Sicil No", "Ad Soyad", "Görev Yeri",
    ...days.map((d) => {
      const dd = d.getUTCDate();
      const dow = ["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"][d.getUTCDay()];
      return `${dd}\n${dow}`;
    }),
    "Çalışma\nGünü", "Net\nSaat", "Fazla\nMesai",
  ]);

  headerRow.height = 36;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF334155" } },
      right:  { style: "hair", color: { argb: "FF334155" } },
    };
    // Weekend and Holiday columns
    const dayColIndex = colNumber - fixedCols.length - 1;
    if (dayColIndex >= 0 && dayColIndex < days.length) {
      const dKey = days[dayColIndex].toISOString().slice(0, 10);
      if (holidayMap.has(dKey)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4C1D95" } };
      } else if (isWeekend(days[dayColIndex])) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3748" } };
      }
    }
  });

  // ── Data rows ────────────────────────────────────────────────────
  employees.forEach((emp, rowIdx) => {
    const empDayMap = dayMap.get(emp.id);
    let totalWorkedDays = 0;
    let totalWorkedMinutes = 0;
    let totalOvertimeMinutes = 0;

    const rowValues: (string | number)[] = [
      rowIdx + 1,
      emp.employeeNo,
      `${emp.lastName} ${emp.firstName}`,
      emp.workplace.name,
    ];

    days.forEach((d) => {
      const dateKey = d.toISOString().slice(0, 10);
      const attendance = empDayMap?.get(dateKey);
      let cellValue = "";

      if (attendance) {
        switch (attendance.status) {
          case "PRESENT":
            cellValue = formatMinutes(attendance.workedMinutes);
            totalWorkedDays++;
            totalWorkedMinutes += attendance.workedMinutes;
            totalOvertimeMinutes += attendance.overtimeMinutes;
            break;
          case "HALF_DAY":
            cellValue = `Y (${formatMinutes(attendance.workedMinutes)})`;
            totalWorkedDays += 0.5;
            totalWorkedMinutes += attendance.workedMinutes;
            totalOvertimeMinutes += attendance.overtimeMinutes;
            break;
          default:
            cellValue = STATUS_LABELS[attendance.status] ?? attendance.status;
            break;
        }
      } else if (holidayMap.has(dateKey)) {
        const h = holidayMap.get(dateKey)!;
        cellValue = h.type === "HALF_DAY" ? "Y (Tatil)" : "Resmi Tatil";
      } else if (isWeekend(d)) {
        cellValue = "T";
      }

      rowValues.push(cellValue);
    });

    rowValues.push(totalWorkedDays, formatMinutes(totalWorkedMinutes), formatMinutes(totalOvertimeMinutes));

    const dataRow = ws.addRow(rowValues);
    dataRow.height = 22;

    dataRow.eachCell((cell, colNumber) => {
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
      cell.font = { size: 9 };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FF334155" } },
        right:  { style: "hair", color: { argb: "FF334155" } },
      };

      const dayColIndex = colNumber - fixedCols.length - 1;
      if (dayColIndex >= 0 && dayColIndex < days.length) {
        const d = days[dayColIndex];
        if (isWeekend(d)) {
          cell.fill = weekendFill;
          cell.font = { ...cell.font, color: { argb: "FF64748B" } };
        } else {
          const val = String(cell.value ?? "");
          if (val.match(/^\d+:\d+$/)) {
            cell.fill = presentFill;
            cell.font = { ...cell.font, color: { argb: "FF86EFAC" } };
          } else if (val === "Devamsız") {
            cell.fill = absentFill;
            cell.font = { ...cell.font, color: { argb: "FFFCA5A5" } };
          } else if (val) {
            cell.fill = leaveFill;
            cell.font = { ...cell.font, color: { argb: "FFFDE68A" } };
          }
        }
      }

      // First 4 columns
      if (colNumber <= 4) {
        cell.alignment = { ...cell.alignment, horizontal: colNumber <= 2 ? "center" : "left" };
        if (colNumber === 3) cell.font = { ...cell.font, bold: true };
      }
    });

    // Alternating row background for fixed columns
    if (rowIdx % 2 === 0) {
      for (let c = 1; c <= 4; c++) {
        const cell = dataRow.getCell(c);
        if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb === "FF000000") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A2744" } };
        }
      }
    }
  });

  // ── Summary totals row ───────────────────────────────────────────
  const totalsRow = ws.addRow(["", "", "TOPLAM", "", ...days.map(() => ""), "", "", ""]);
  totalsRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  totalsRow.fill = headerFill;
  totalsRow.height = 22;

  // ── Freeze panes ────────────────────────────────────────────────
  ws.views = [{ state: "frozen", xSplit: 4, ySplit: 2, topLeftCell: "E3" }];

  // ── Auto filter ─────────────────────────────────────────────────
  ws.autoFilter = { from: "A2", to: { row: 2, column: totalCols } };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
