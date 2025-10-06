// src/routes/upload.ts
import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import csv from "csv-parser";
import { Readable } from "stream";
import prisma from "../lib/prisma";

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = (req as any).file;
    const userId = (req as any).body.userId;

    if (!file) return res.status(400).json({ error: "No file uploaded" });
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    // ✅ Check if user exists
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) return res.status(400).json({ error: "Invalid userId" });

    let rows: any[] = [];
    if (file.mimetype === "text/csv") {
      // ✅ Handle CSV file
      const stream = Readable.from(file.buffer.toString());
      await new Promise((resolve, reject) => {
        stream
          .pipe(csv())
          .on("data", (data) => rows.push(data))
          .on("end", resolve)
          .on("error", reject);
      });
    } else if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      // ✅ Read Excel file with multiple sheets support
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      
      console.log("Available sheets:", workbook.SheetNames);
      
      // Try to find the sheet with budget data
      let targetSheet = null;
      let allRows: any[] = [];
      
      // Prioritize specific sheet names that are likely to contain budget data
      const prioritySheets = ['Budget_Input', 'Budget Input', 'BudgetData', 'Data', 'Main', 'Budget_input_2025', 'Fiscal_Year_23-25'];
      
      // First, try to find priority sheets - prioritize Budget_input_2025, then Budget_Input, then others
      const budgetInputSheet = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('budget_input_2025') || 
        name.toLowerCase().includes('budget_input') || 
        name.toLowerCase().includes('budget input')
      );
      
      if (budgetInputSheet) {
        console.log(`Found Budget_Input sheet: "${budgetInputSheet}"`);
        const sheet = workbook.Sheets[budgetInputSheet];
        
        // Try multiple parsing approaches for Budget_Input specifically
        const approaches = [
          { type: 'header: 1', name: 'header-first' },
          { type: 'defval: null', name: 'standard' },
          { type: 'raw: true', name: 'raw' }
        ];
        
        for (const approach of approaches) {
          console.log(`Trying ${approach.name} approach for Budget_Input`);
          let sheetData;
          
          if (approach.type === 'header: 1') {
            sheetData = XLSX.utils.sheet_to_json(sheet, { defval: null, header: 1 });
            if (sheetData.length > 1) {
              const headerRow = sheetData[0] as string[];
              const dataRows = sheetData.slice(1) as any[][];
              allRows = dataRows.map(row => {
                const obj: any = {};
                headerRow.forEach((header, index) => {
                  if (header) {
                    obj[header] = row[index] || null;
                  }
                });
                return obj;
              }).filter(row => {
                return Object.values(row).some(value => value !== null && value !== undefined && value !== '' && value !== 0);
              });
            }
          } else if (approach.type === 'raw: true') {
            sheetData = XLSX.utils.sheet_to_json(sheet, { raw: true });
            allRows = sheetData.filter((row: any) => {
              return Object.values(row).some(value => value !== null && value !== undefined && value !== '' && value !== 0);
            });
          } else {
            sheetData = XLSX.utils.sheet_to_json(sheet, { defval: null });
            allRows = sheetData.filter((row: any) => {
              return Object.values(row).some(value => value !== null && value !== undefined && value !== '' && value !== 0);
            });
          }
          
          console.log(`${approach.name} approach found ${allRows.length} rows`);
          
          if (allRows.length > 0) {
            targetSheet = budgetInputSheet;
            console.log(`Successfully parsed Budget_Input using ${approach.name} approach`);
            if (allRows[0]) {
              console.log('Sample Budget_Input data:', allRows[0]);
              console.log('Budget_Input columns:', Object.keys(allRows[0]));
            }
            break;
          }
        }
      }
      
      // If Budget_Input wasn't found or had no data, try other priority sheets
      if (!targetSheet) {
        // First try Fiscal_Year_23-25 sheet specifically
        const fiscalYearSheet = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('fiscal_year_23-25') || 
          name.toLowerCase().includes('fiscal year 23-25')
        );
        
        if (fiscalYearSheet) {
          console.log(`Found Fiscal_Year_23-25 sheet: "${fiscalYearSheet}"`);
          const sheet = workbook.Sheets[fiscalYearSheet];
          const sheetData = XLSX.utils.sheet_to_json(sheet, { defval: null, header: 1 });
          
          console.log(`Fiscal_Year_23-25 sheet has ${sheetData.length} total rows`);
          
          if (sheetData.length > 1) {
            const headerRow = sheetData[0] as string[];
            console.log(`Fiscal_Year_23-25 sheet headers:`, headerRow);
            
            const dataRows = sheetData.slice(1) as any[][];
            const sheetRows = dataRows.map(row => {
              const obj: any = {};
              headerRow.forEach((header, index) => {
                if (header) {
                  obj[header] = row[index] || null;
                }
              });
              return obj;
            }).filter(row => {
              return Object.values(row).some(value => value !== null && value !== undefined && value !== '' && value !== 0);
            });
            
            console.log(`Fiscal_Year_23-25 sheet has ${sheetRows.length} non-empty rows after filtering`);
            
            if (sheetRows.length > 0) {
              targetSheet = fiscalYearSheet;
              allRows = sheetRows;
              console.log(`Successfully parsed Fiscal_Year_23-25 sheet with ${allRows.length} rows`);
            }
          }
        }
        
        // If still no target sheet, try other priority sheets
        if (!targetSheet) {
          for (const sheetName of workbook.SheetNames) {
            if (prioritySheets.some(priority => 
              sheetName.toLowerCase().includes(priority.toLowerCase()) && 
              !sheetName.toLowerCase().includes('budget_input') && 
              !sheetName.toLowerCase().includes('budget input') &&
              !sheetName.toLowerCase().includes('fiscal_year_23-25') &&
              !sheetName.toLowerCase().includes('fiscal year 23-25')
            )) {
            console.log(`Found other priority sheet: "${sheetName}"`);
            const sheet = workbook.Sheets[sheetName];
            const sheetData = XLSX.utils.sheet_to_json(sheet, { defval: null, header: 1 });
            
            console.log(`Priority sheet "${sheetName}" has ${sheetData.length} total rows`);
            
            if (sheetData.length > 1) {
              // Try different parsing approaches for this sheet
              const headerRow = sheetData[0] as string[];
              console.log(`Priority sheet "${sheetName}" headers:`, headerRow);
              
              // Convert to object format
              const dataRows = sheetData.slice(1) as any[][];
              const sheetRows = dataRows.map(row => {
                const obj: any = {};
                headerRow.forEach((header, index) => {
                  if (header) {
                    obj[header] = row[index] || null;
                  }
                });
                return obj;
              }).filter(row => {
                // More lenient filtering for priority sheets
                return Object.values(row).some(value => value !== null && value !== undefined && value !== '' && value !== 0);
              });
              
              console.log(`Priority sheet "${sheetName}" has ${sheetRows.length} non-empty rows after filtering`);
              
              if (sheetRows.length > 0) {
                targetSheet = sheetName;
                allRows = sheetRows;
                break; // Use this sheet immediately
              } else {
                // If no data found with standard parsing, try alternative parsing
                console.log(`Trying alternative parsing for priority sheet "${sheetName}"`);
                const altSheetData = XLSX.utils.sheet_to_json(sheet, { defval: null });
                console.log(`Alternative parsing found ${altSheetData.length} rows`);
                
                if (altSheetData.length > 0) {
                  console.log(`Alternative parsing sample:`, altSheetData[0]);
                  const altRows = altSheetData.filter((row: any) => {
                    return Object.values(row).some(value => value !== null && value !== undefined && value !== '' && value !== 0);
                  });
                  
                  console.log(`Alternative parsing filtered to ${altRows.length} rows`);
                  
                  if (altRows.length > 0) {
                    targetSheet = sheetName;
                    allRows = altRows;
                    break;
                  }
                }
              }
            }
          }
        }
      }
      
      // If no priority sheet found with data, continue with other sheets
      if (!targetSheet) {
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const sheetData = XLSX.utils.sheet_to_json(sheet, { defval: null, header: 1 });
          
          // Check if this sheet has meaningful data (more than just headers)
          if (sheetData.length > 1) {
            console.log(`Sheet "${sheetName}" has ${sheetData.length} rows`);
            
            // Convert to object format for processing
            const headerRow = sheetData[0] as string[];
            const dataRows = sheetData.slice(1) as any[][];
            
            const sheetRows = dataRows.map(row => {
              const obj: any = {};
              headerRow.forEach((header, index) => {
                if (header) {
                  obj[header] = row[index] || null;
                }
              });
              return obj;
            }).filter(row => {
              // Filter out completely empty rows
              return Object.values(row).some(value => value !== null && value !== undefined && value !== '');
            });
            
            console.log(`Sheet "${sheetName}" has ${sheetRows.length} non-empty rows`);
            if (sheetRows.length > 0) {
              console.log(`Sheet "${sheetName}" columns:`, Object.keys(sheetRows[0]));
            }
            
            if (sheetRows.length > 0) {
              // Check if this sheet has budget-related columns (including template format)
              const hasBudgetColumns = sheetRows.some(row => {
                const keys = Object.keys(row);
                return keys.some(key => 
                  key && (
                    key.toLowerCase().includes('quarter') ||
                    key.toLowerCase().includes('q1') ||
                    key.toLowerCase().includes('q2') ||
                    key.toLowerCase().includes('q3') ||
                    key.toLowerCase().includes('q4') ||
                    key.toLowerCase().includes('amount') ||
                    key.toLowerCase().includes('budget') ||
                    key.toLowerCase().includes('unit cost') ||
                    key.toLowerCase().includes('volume') ||
                    key.toLowerCase().includes('driver') ||
                    key.toLowerCase().includes('department') ||
                    key.toLowerCase().includes('rollup') ||
                    key.toLowerCase().includes('dept proposal') ||
                    key.toLowerCase().includes('last fy') ||
                    key.toLowerCase().includes('system forecast') ||
                    key.toLowerCase().includes('variance') ||
                    key.toLowerCase().includes('rationale') ||
                    key.toLowerCase().includes('flag')
                  )
                );
              });
              
              if (hasBudgetColumns) {
                console.log(`Found budget data in sheet: "${sheetName}"`);
                targetSheet = sheetName;
                allRows = [...allRows, ...sheetRows];
              } else {
                // If no budget columns found, still include if it's the first meaningful sheet
                if (!targetSheet && sheetRows.length > 0) {
                  targetSheet = sheetName;
                  allRows = [...allRows, ...sheetRows];
                }
              }
            }
          }
        }
        }
      }
      
      // Special handling for Budget_Input or Budget_input_2025 sheet if it wasn't processed above
      const budgetInputSheetName = workbook.SheetNames.find(name => 
        name === 'Budget_Input' || name === 'Budget_input_2025' || 
        name.toLowerCase().includes('budget_input')
      );
      
      if (!targetSheet && budgetInputSheetName) {
        console.log(`Attempting special handling for ${budgetInputSheetName} sheet`);
        const budgetInputSheet = workbook.Sheets[budgetInputSheetName];
        
        // Try multiple parsing approaches
        const approaches = [
          { type: 'header: 1', name: 'header-first' },
          { type: 'defval: null', name: 'standard' },
          { type: 'raw: true', name: 'raw' }
        ];
        
        for (const approach of approaches) {
          console.log(`Trying ${approach.name} approach for Budget_Input`);
          let sheetData;
          
          if (approach.type === 'header: 1') {
            sheetData = XLSX.utils.sheet_to_json(budgetInputSheet, { defval: null, header: 1 });
            if (sheetData.length > 1) {
              const headerRow = sheetData[0] as string[];
              const dataRows = sheetData.slice(1) as any[][];
              allRows = dataRows.map(row => {
                const obj: any = {};
                headerRow.forEach((header, index) => {
                  if (header) {
                    obj[header] = row[index] || null;
                  }
                });
                return obj;
              }).filter(row => {
                return Object.values(row).some(value => value !== null && value !== undefined && value !== '' && value !== 0);
              });
            }
          } else if (approach.type === 'raw: true') {
            sheetData = XLSX.utils.sheet_to_json(budgetInputSheet, { raw: true });
            allRows = sheetData.filter((row: any) => {
              return Object.values(row).some(value => value !== null && value !== undefined && value !== '' && value !== 0);
            });
          } else {
            sheetData = XLSX.utils.sheet_to_json(budgetInputSheet, { defval: null });
            allRows = sheetData.filter((row: any) => {
              return Object.values(row).some(value => value !== null && value !== undefined && value !== '' && value !== 0);
            });
          }
          
          console.log(`${approach.name} approach found ${allRows.length} rows`);
          
          if (allRows.length > 0) {
            targetSheet = budgetInputSheetName;
            console.log(`Successfully parsed ${budgetInputSheetName} using ${approach.name} approach`);
            if (allRows[0]) {
              console.log(`Sample ${budgetInputSheetName} data:`, allRows[0]);
              console.log(`${budgetInputSheetName} columns:`, Object.keys(allRows[0]));
            }
            break;
          }
        }
      }
      
      // If still no sheet found, use the first sheet with data
      if (!targetSheet && workbook.SheetNames.length > 0) {
        targetSheet = workbook.SheetNames[0];
        const sheet = workbook.Sheets[targetSheet];
        allRows = XLSX.utils.sheet_to_json(sheet, { defval: null });
      }
      
      if (allRows.length === 0) {
        return res.status(400).json({ 
          error: "No data found in any sheet", 
          details: `Available sheets: ${workbook.SheetNames.join(', ')}` 
        });
      }
      
      rows = allRows;
      console.log(`Using sheet: "${targetSheet}" with ${rows.length} rows`);
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    console.log(`Total rows to process: ${rows.length}`);
    console.log("Sample raw row data:", rows[0]);
    console.log("Available columns in first row:", rows[0] ? Object.keys(rows[0]) : "No data");

    // ✅ Enhanced CSV/Excel parsing with better field mapping
    const normalizedRows = rows.map((row, index) => {
      if (index < 3) { // Only log first 3 rows to avoid spam
        console.log(`Row ${index + 1} raw data:`, row);
      }
      
      // Enhanced field mapping for various CSV/Excel formats (including template variations)
      let description = row.Description || row.description || row['ACCOUNT CATEGORY'] || 
                       row['Account Category'] || row['Item Description'] || row['DESCRIPTION'] ||
                       row['Item'] || row['ITEM'] || row['Particulars'] || row['PARTICULARS'] ||
                       row['Expense Item'] || row['EXPENSE ITEM'] || row['Budget Item'] ||
                       row['Driver'] || row['DRIVER'] || row['Definition (auto)'] || null;
      
      // Fallback: if no description found, try to find any text column that might be a description
      if (!description || description === "Untitled") {
        const rowKeys = Object.keys(row);
        const textColumn = rowKeys.find(key => {
          const value = row[key];
          return value && typeof value === 'string' && 
                 value.length > 3 && 
                 !key.toLowerCase().includes('quarter') &&
                 !key.toLowerCase().includes('amount') &&
                 !key.toLowerCase().includes('total') &&
                 !key.toLowerCase().includes('year');
        });
        
        if (textColumn) {
          description = row[textColumn];
        }
      }
      
      if (!description) description = "Untitled";
      
      const justification = row.Justification || row.justification || row['JUSTIFICATION'] || 
                           row['Justification'] || row['Notes'] || row['NOTES'] || 
                           row['Remarks'] || row['REMARKS'] || row['Purpose'] || row['PURPOSE'] ||
                           row['Rationale (required if flagged)'] || row['Rationale'] || null;
      
      const category = row.Category || row.category || row['CATEGORY'] || 
                      row['Account Type'] || row['ACCOUNT TYPE'] || row['Type'] || 
                      row['Classification'] || row['CLASSIFICATION'] || row['Account'] ||
                      row['Dept Category (Dropdown)'] || row['DEPT CATEGORY'] || "Uncategorized";
      
      const department = row.Department || row.department || row['DEPARTMENT'] || 
                        row['Dept'] || row['DEPT'] || row['Unit'] || row['UNIT'] || 
                        row['Office'] || row['OFFICE'] || row['Division'] || row['DIVISION'] ||
                        row['Department (Dropdown)'] || row['Dept Code (auto)'] || "Unknown";
      
      // Enhanced year parsing with multiple formats
      const parsedYear = Number(row.Year) || Number(row.year) || Number(row['YEAR']) || 
                        Number(row['Budget Year']) || Number(row['BUDGET YEAR']) || 
                        Number(row['FY']) || Number(row['Fiscal Year']) || new Date().getFullYear();
      
      console.log(`Row ${index + 1} parsed year:`, parsedYear);
      
      // Enhanced quarterly amount parsing with currency handling
      const parseAmount = (value: any): number => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          // Remove currency symbols, commas, and whitespace
          const cleaned = value.replace(/[₱$,\s]/g, '').replace(/[()]/g, '-');
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };
      
      // Try to find quarter columns with more flexible matching
      const findQuarterValue = (quarterNum: number): number => {
        const patterns = [
          `Q${quarterNum}`, `q${quarterNum}`,
          `${quarterNum}ST QUARTER`, `${quarterNum}st Quarter`,
          `${quarterNum}ND QUARTER`, `${quarterNum}nd Quarter`,
          `${quarterNum}RD QUARTER`, `${quarterNum}rd Quarter`,
          `${quarterNum}TH QUARTER`, `${quarterNum}th Quarter`,
          `Quarter ${quarterNum}`, `QUARTER ${quarterNum}`,
          `Q${quarterNum} Amount`, `Q${quarterNum} AMOUNT`
        ];
        
        for (const pattern of patterns) {
          if (row[pattern] !== undefined && row[pattern] !== null) {
            return parseAmount(row[pattern]);
          }
        }
        
        // Fallback: look for any column that contains the quarter number
        const rowKeys = Object.keys(row);
        const quarterKey = rowKeys.find(key => 
          key && (
            key.includes(`Q${quarterNum}`) || 
            key.includes(`${quarterNum}ST`) || 
            key.includes(`${quarterNum}ND`) ||
            key.includes(`${quarterNum}RD`) ||
            key.includes(`${quarterNum}TH`) ||
            key.toLowerCase().includes(`quarter ${quarterNum}`)
          )
        );
        
        if (quarterKey) {
          return parseAmount(row[quarterKey]);
        }
        
        return 0;
      };
      
      // Check if this is a template format (Budget_Input template)
      const unitCost = parseAmount(row['Unit Cost'] || row['UNIT COST'] || row['UnitCost']);
      const volume = parseAmount(row['Volume'] || row['VOLUME']);
      const calculatedAmount = parseAmount(row['Amount (=Unit*Vol)'] || row['Amount'] || row['AMOUNT']);
      const deptProposal = parseAmount(row['Dept Proposal (=Amount by default)'] || row['Dept Proposal'] || row['DEPT PROPOSAL']);
      const lastFYActual = parseAmount(row['Last FY Actual'] || row['Last FY'] || row['LAST FY ACTUAL']);
      const systemForecast = parseAmount(row['System Forecast'] || row['System'] || row['SYSTEM FORECAST']);
      const variance = parseAmount(row['Variance (=Proposal - Forecast)'] || row['Variance'] || row['VARIANCE']);
      const percentVar = parseAmount(row['% Var (=Variance/Forecast)'] || row['% Var'] || row['PERCENT VAR']);
      const flag = row['Flag (auto)'] || row['Flag'] || row['FLAG'];
      
      let q1, q2, q3, q4, total;
      
      if (unitCost > 0 || volume > 0 || calculatedAmount > 0 || deptProposal > 0) {
        // Template format: use Dept Proposal as primary amount, fallback to calculated amount
        const primaryAmount = deptProposal > 0 ? deptProposal : calculatedAmount;
        const fallbackAmount = calculatedAmount > 0 ? calculatedAmount : (unitCost * volume);
        const annualAmount = primaryAmount > 0 ? primaryAmount : fallbackAmount;
        
        // For template format, distribute evenly across quarters or use as Q1
        q1 = annualAmount;
        q2 = 0;
        q3 = 0;
        q4 = 0;
        total = annualAmount;
        
        console.log(`Template format detected - Unit Cost: ${unitCost}, Volume: ${volume}, Calculated Amount: ${calculatedAmount}, Dept Proposal: ${deptProposal}, Final Amount: ${annualAmount}`);
        
        // Log additional template data if available
        if (lastFYActual > 0 || systemForecast > 0 || variance !== 0) {
          console.log(`Template variance data - Last FY: ${lastFYActual}, Forecast: ${systemForecast}, Variance: ${variance}, %Var: ${percentVar}, Flag: ${flag}`);
        }
      } else {
        // Standard quarterly format
        q1 = findQuarterValue(1);
        q2 = findQuarterValue(2);
        q3 = findQuarterValue(3);
        q4 = findQuarterValue(4);
        
        // Calculate total if not provided
        const providedTotal = parseAmount(row.Total || row.total || row['TOTAL'] || row['Annual Total'] || row['ANNUAL TOTAL']);
        const calculatedTotal = q1 + q2 + q3 + q4;
        total = providedTotal > 0 ? providedTotal : calculatedTotal;
      }
      
      return {
        description: description.trim(),
        justification: justification ? justification.trim() : null,
        category: category.trim(),
        department: department.trim(),
        year: parsedYear,
        q1,
        q2,
        q3,
        q4,
        total,
        // Additional template data
        unitCost: unitCost,
        volume: volume,
        calculatedAmount: calculatedAmount,
        deptProposal: deptProposal,
        lastFYActual: lastFYActual,
        systemForecast: systemForecast,
        variance: variance,
        percentVar: percentVar,
        flag: flag,
      };
    }).filter(row => {
      // Exclude metadata rows that are clearly not budget data
      const metadataKeywords = ['version', 'generated on', 'owner', 'author', 'purpose', 'flag threshold', 'instructions', 'summary'];
      const isMetadata = metadataKeywords.some(keyword => 
        row.description && row.description.toLowerCase().includes(keyword)
      );
      
      if (isMetadata) {
        console.log(`Filtering out metadata row: "${row.description}"`);
        return false;
      }
      
      // More lenient filtering for template formats
      // Keep rows that have meaningful descriptions or any non-zero amounts
      const hasDescription = row.description && row.description !== "Untitled" && row.description.trim().length > 0;
      const hasAmounts = row.q1 > 0 || row.q2 > 0 || row.q3 > 0 || row.q4 > 0 || row.total > 0;
      const hasDepartment = row.department && row.department !== "Unknown" && row.department.trim().length > 0;
      
      // Keep rows that have either a description, amounts, or department info
      return hasDescription || hasAmounts || hasDepartment;
    });

    // ✅ Validate parsed data
    if (normalizedRows.length === 0) {
      return res.status(400).json({ error: "No valid data rows found in the uploaded file" });
    }

    // ✅ Validate required fields and data integrity
    const validationErrors: string[] = [];
    normalizedRows.forEach((row, index) => {
      if (!row.description || row.description.trim() === "") {
        validationErrors.push(`Row ${index + 1}: Missing description`);
      }
      if (row.year < 2000 || row.year > 2100) {
        validationErrors.push(`Row ${index + 1}: Invalid year (${row.year})`);
      }
      if (row.q1 < 0 || row.q2 < 0 || row.q3 < 0 || row.q4 < 0) {
        validationErrors.push(`Row ${index + 1}: Negative amounts not allowed`);
      }
      if (row.total < 0) {
        validationErrors.push(`Row ${index + 1}: Negative total amount not allowed`);
      }
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: "Data validation failed", 
        details: validationErrors.slice(0, 10) // Show first 10 errors
      });
    }

    // ✅ Create new proposal with better naming
    const proposal = await prisma.budgetProposal.create({
      data: {
        title: `Budget Proposal - ${new Date().toLocaleDateString()} - ${normalizedRows.length} items`,
        description: `Uploaded from ${file.originalname}`,
        year: normalizedRows[0]?.year || new Date().getFullYear(),
        authorId: userId,
      },
    });

    // ✅ Insert line items and allocations
    for (const row of normalizedRows) {
      const lineItem = await (prisma.budgetLineItem as any).create({
        data: {
          description: row.description,
          justification: row.justification,
          department: row.department,
          year: row.year, // Save the year from the normalized row
          category: {
            connectOrCreate: {
              where: { name: row.category },
              create: { name: row.category },
            },
          },
          budgetProposal: { connect: { id: proposal.id } },
        },
      });

      const allocations = [
        { quarter: 1, proposedAmount: row.q1 },
        { quarter: 2, proposedAmount: row.q2 },
        { quarter: 3, proposedAmount: row.q3 },
        { quarter: 4, proposedAmount: row.q4 },
        { quarter: 0, proposedAmount: row.total }, // annual total
      ];

      for (const alloc of allocations) {
        if (alloc.proposedAmount > 0) {
          await prisma.budgetAllocation.create({
            data: {
              quarter: alloc.quarter,
              proposedAmount: alloc.proposedAmount,
              budgetLineItemId: lineItem.id,
            },
          });
        }
      }
    }

    // ✅ Calculate summary statistics
    const totalBudget = normalizedRows.reduce((sum, row) => sum + row.total, 0);
    const departments = [...new Set(normalizedRows.map(row => row.department))];
    const categories = [...new Set(normalizedRows.map(row => row.category))];

    res.json({
      success: true,
      count: normalizedRows.length,
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      summary: {
        totalBudget,
        departmentCount: departments.length,
        categoryCount: categories.length,
        departments: departments,
        categories: categories,
      },
      rows: normalizedRows.map((row) => ({
        description: row.description,
        justification: row.justification,
        category: row.category,
        department: row.department,
        year: row.year,
        q1: row.q1,
        q2: row.q2,
        q3: row.q3,
        q4: row.q4,
        total: row.total,
        // Additional template data
        unitCost: row.unitCost,
        volume: row.volume,
        calculatedAmount: row.calculatedAmount,
        deptProposal: row.deptProposal,
        lastFYActual: row.lastFYActual,
        systemForecast: row.systemForecast,
        variance: row.variance,
        percentVar: row.percentVar,
        flag: row.flag,
      })),
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Upload failed", details: err });
  }
});

// Get all rows from proposals for this user
router.get("/rows/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const proposals = await prisma.budgetProposal.findMany({
      where: { authorId: userId },
      include: {
        lineItems: {
          include: { category: true, allocations: true },
        },
      },
    });

    const allRows = proposals.flatMap((proposal) =>
      proposal.lineItems.map((item: any) => {
        const q1 = item.allocations.find((a: any) => a.quarter === 1)?.proposedAmount || 0;
        const q2 = item.allocations.find((a: any) => a.quarter === 2)?.proposedAmount || 0;
        const q3 = item.allocations.find((a: any) => a.quarter === 3)?.proposedAmount || 0;
        const q4 = item.allocations.find((a: any) => a.quarter === 4)?.proposedAmount || 0;
        const totalAlloc = item.allocations.find((a: any) => a.quarter === 0)?.proposedAmount;
        const total = typeof totalAlloc === "number" ? totalAlloc : q1 + q2 + q3 + q4;

        return {
          description: item.description,
          justification: item.justification,
          category: item.category.name,
          department: item.department || "N/A",
          year: proposal.year,
          q1,
          q2,
          q3,
          q4,
          total,
        };
      })
    );

    res.json({ rows: allRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch rows" });
  }
});

export default router;
