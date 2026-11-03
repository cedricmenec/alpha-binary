import { AlphaMetricsError, inspectAlpha } from '../core/index.js';
import { CliPngError, readPngFile } from './png-files.js';

export const INSPECT_USAGE = [
  'Usage: alpha-binary inspect <source.png> [options]',
  '',
  'Analyse a PNG alpha distribution and isolated opaque pixels without writing it.',
  '',
  'Options:',
  '  --printed-width <mm>  Printed width in millimetres; enables physical pixel size',
  '  --json                Emit a machine-readable diagnostic',
  '  -h, --help            Show inspect help',
  '',
  'Metrics are indicators of potential fragility, not a print certification.',
  '',
].join('\n');

const DECIMAL = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

export class InspectUsageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'InspectUsageError';
    this.code = code;
  }
}

function usageFail(code, message) {
  throw new InspectUsageError(code, message);
}

function readOptionValue(argv, index, option) {
  const value = argv[index];
  if (
    value === undefined ||
    value === '-h' ||
    value === '--help' ||
    value === '--' ||
    value.startsWith('--')
  ) {
    usageFail('CLI_MISSING_OPTION_VALUE', `Option "${option}" requires a value`);
  }
  return value;
}

function parsePrintedWidth(value) {
  if (!DECIMAL.test(value)) {
    usageFail(
      'CLI_INVALID_PRINTED_WIDTH',
      'Printed width must be a positive finite decimal number of millimetres',
    );
  }

  const printedWidth = Number(value);
  if (!Number.isFinite(printedWidth) || printedWidth <= 0) {
    usageFail(
      'CLI_INVALID_PRINTED_WIDTH',
      'Printed width must be a positive finite decimal number of millimetres',
    );
  }

  return printedWidth;
}

export function parseInspectArgs(argv) {
  const positionals = [];
  let help = false;
  let json = false;
  let sawPrintedWidth = false;
  let printedWidthValue;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '-h' || argument === '--help') {
      help = true;
      continue;
    }

    if (argument === '--json') {
      if (json) usageFail('CLI_DUPLICATE_OPTION', 'Option "--json" was supplied more than once');
      json = true;
      continue;
    }

    if (argument === '--printed-width') {
      if (sawPrintedWidth) {
        usageFail(
          'CLI_DUPLICATE_OPTION',
          'Option "--printed-width" was supplied more than once',
        );
      }
      sawPrintedWidth = true;
      printedWidthValue = readOptionValue(argv, (index += 1), '--printed-width');
      continue;
    }

    if (argument.startsWith('-')) {
      usageFail('CLI_UNKNOWN_OPTION', `Unknown option "${argument}"`);
    }

    positionals.push(argument);
  }

  if (help) {
    return { help: true, json };
  }

  if (positionals.length === 0) {
    usageFail('CLI_MISSING_PATHS', 'Inspect requires a source path');
  }
  if (positionals.length > 1) {
    usageFail('CLI_EXTRA_PATHS', 'Inspect accepts exactly one source path');
  }

  return {
    help: false,
    json,
    source: positionals[0],
    printedWidth: sawPrintedWidth ? parsePrintedWidth(printedWidthValue) : undefined,
  };
}

function executeInspect(options, dependencies) {
  const read = dependencies.readPngFile ?? readPngFile;
  const measure = dependencies.inspectAlpha ?? inspectAlpha;

  const sourceImage = read(options.source);
  const metrics = measure(
    sourceImage,
    options.printedWidth === undefined ? {} : { printedWidth: options.printedWidth },
  );

  return {
    source: options.source,
    ...metrics,
  };
}

function writeSuccess(io, json, result) {
  if (json) {
    io.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  const isolatedToOpaque =
    result.ratios.isolatedToOpaque === null ? 'N/A' : String(result.ratios.isolatedToOpaque);
  const physical =
    result.physical === null
      ? 'not computed'
      : `${result.physical.millimetresPerPixel} mm/pixel (printed width ${result.physical.printedWidth} mm)`;

  const lines = [
    'Inspected PNG',
    `Source: ${result.source}`,
    `Dimensions: ${result.width}x${result.height}`,
    `Total pixels: ${result.total}`,
    `Alpha 0: ${result.alpha.zero}`,
    `Alpha 255: ${result.alpha.full}`,
    `Alpha intermediate: ${result.alpha.intermediate}`,
    `Isolated opaque: ${result.isolatedOpaque}`,
    `Isolated/opaque: ${isolatedToOpaque}`,
    `Isolated/total: ${result.ratios.isolatedToTotal}`,
    `Physical pixel size: ${physical}`,
    '',
    'These metrics are indicators of potential fragility, not a print certification.',
    '',
  ];
  io.stdout.write(lines.join('\n'));
}

function writeFailure(io, json, error) {
  const code = error.code ?? 'CLI_PROCESSING_FAILED';
  const message = error.message ?? 'Unexpected processing failure';
  const path = error.path;

  if (json) {
    const payload = { error: { code, message } };
    if (path !== undefined) payload.error.path = path;
    io.stderr.write(`${JSON.stringify(payload)}\n`);
    return;
  }

  const location = path !== undefined && !message.includes(path) ? ` (${path})` : '';
  io.stderr.write(`alpha-binary inspect: ${code}: ${message}${location}\n`);
}

export function runInspectCommand(argv, io, dependencies = {}) {
  const jsonRequested = argv.includes('--json');
  let options;

  try {
    options = parseInspectArgs(argv);
  } catch (error) {
    if (error instanceof InspectUsageError) {
      writeFailure(io, jsonRequested, error);
      return 2;
    }
    throw error;
  }

  if (options.help) {
    io.stdout.write(INSPECT_USAGE);
    return 0;
  }

  try {
    const result = executeInspect(options, dependencies);
    writeSuccess(io, options.json, result);
    return 0;
  } catch (error) {
    if (error instanceof AlphaMetricsError) {
      writeFailure(io, options.json, error);
      return 2;
    }

    const diagnostic =
      error instanceof CliPngError
        ? error
        : new CliPngError(
            'CLI_PROCESSING_FAILED',
            error instanceof Error ? error.message : 'Unexpected processing failure',
            { cause: error },
          );
    writeFailure(io, options.json, diagnostic);
    return 3;
  }
}
