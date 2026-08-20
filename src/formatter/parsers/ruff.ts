import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

export function parseRuffOutput(rawOutput: string): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];

  // Check if JSON output
  if (clean.trim().startsWith('[')) {
    try {
      const items = JSON.parse(clean);
      for (const item of items) {
        if (item.code && item.filename) {
          diagnostics.push({
            source: 'ruff',
            rule_id: item.code,
            severity: 'ERROR',
            file_path: item.filename,
            range: {
              start: {
                line: item.location?.row || 1,
                column: item.location?.column || 1,
              },
              end: {
                line: item.end_location?.row || item.location?.row || 1,
                column: item.end_location?.column || item.location?.column || 1,
              },
            },
            error_message: item.message || 'Ruff violation',
            repair_instruction: generateRuffRepair(item.code, item.message),
          });
        }
      }
      if (diagnostics.length > 0) return diagnostics;
    } catch {
      // Continue to regex
    }
  }

  // Regex parsing: path/to/file.py:row:col: CODE [*] Message
  const lines = clean.split('\n');
  for (const line of lines) {
    const match = line.match(/^([^\s:]+\.py):(\d+):(\d+):\s*([A-Z0-9]+)\s*(?:\[\*\])?\s*(.*)$/);
    if (match) {
      const [, filePath, rowStr, colStr, code, message] = match;
      const row = parseInt(rowStr, 10);
      const col = parseInt(colStr, 10);

      diagnostics.push({
        source: 'ruff',
        rule_id: code,
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: row, column: col },
          end: { line: row, column: col + 10 },
        },
        error_message: message.trim(),
        repair_instruction: generateRuffRepair(code, message.trim()),
      });
    }
  }

  return diagnostics;
}

function generateRuffRepair(code: string, message: string = ''): DiagnosticItem['repair_instruction'] {
  if (code.startsWith('F401')) {
    return {
      action: 'DELETE_LINE',
      description: 'Remove unused import statement.',
      repair_tokens: ['# Remove unused import'],
    };
  }

  if (code.startsWith('E722') || code.startsWith('B001')) {
    return {
      action: 'REWRITE_BLOCK',
      description: 'Do not use bare `except:`. Specify explicit exception type (e.g. `except Exception as e:`).',
      repair_tokens: [
        'except Exception as err:',
        '    logger.error(f"Operation failed: {err}")',
        '    raise',
      ],
    };
  }

  if (code.startsWith('F841')) {
    return {
      action: 'DELETE_LINE',
      description: 'Remove unused local variable or prefix with underscore `_`.',
      repair_tokens: ['_ = ...'],
    };
  }

  return {
    action: 'EXECUTE_COMMAND',
    description: `Run ruff check --fix ${message ? `to fix: ${message}` : ''}`,
    suggested_command: 'ruff check --fix ${filePath}',
    repair_tokens: ['ruff check --fix'],
  };
}
