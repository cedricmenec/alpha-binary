import {
  BackgroundError,
  ditherAlphaBayer8,
  removeUniformBackground,
} from '../core/index.js';
import { CliPngError, readPngFile, writePngFile } from './png-files.js';

export const CONVERT_USAGE = [
  'Usage: alpha-binary convert <source.png> <output.png> [options]',
  '',
  'Convert a PNG to binary alpha using fixed Bayer 8 x 8 dithering.',
  '',
  'Options:',
  '  --background <hex>   Background color as six hex digits, optionally prefixed by #',
  '  --tolerance <0-255>  Inclusive channel tolerance; required with --background',
  '  --overwrite          Replace an existing output after source-identity checks',
  '  --json               Emit a machine-readable diagnostic',
  '  -h, --help           Show convert help',
  '',
  'No resizing, cropping, AI cutout, or remote service is performed.',
  '',
].join('\n');

export class ConvertUsageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ConvertUsageError';
    this.code = code;
  }
}

function usageFail(code, message) {
  throw new ConvertUsageError(code, message);
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

function parseBackground(value) {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value);
  if (!match) {
    usageFail(
      'CLI_INVALID_BACKGROUND',
      'Background color must be six hexadecimal digits, optionally prefixed by #',
    );
  }

  const hex = match[1];
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function parseTolerance(value) {
  if (!/^\d+$/.test(value)) {
    usageFail('CLI_INVALID_TOLERANCE', 'Tolerance must be an integer from 0 through 255');
  }

  const tolerance = Number(value);
  if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255) {
    usageFail('CLI_INVALID_TOLERANCE', 'Tolerance must be an integer from 0 through 255');
  }
  return tolerance;
}

export function parseConvertArgs(argv) {
  const positionals = [];
  let help = false;
  let json = false;
  let overwrite = false;
  let backgroundValue;
  let toleranceValue;
  let sawBackground = false;
  let sawTolerance = false;

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

    if (argument === '--overwrite') {
      if (overwrite) {
        usageFail('CLI_DUPLICATE_OPTION', 'Option "--overwrite" was supplied more than once');
      }
      overwrite = true;
      continue;
    }

    if (argument === '--background') {
      if (sawBackground) {
        usageFail('CLI_DUPLICATE_OPTION', 'Option "--background" was supplied more than once');
      }
      sawBackground = true;
      backgroundValue = readOptionValue(argv, (index += 1), '--background');
      continue;
    }

    if (argument === '--tolerance') {
      if (sawTolerance) {
        usageFail('CLI_DUPLICATE_OPTION', 'Option "--tolerance" was supplied more than once');
      }
      sawTolerance = true;
      toleranceValue = readOptionValue(argv, (index += 1), '--tolerance');
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

  if (sawBackground !== sawTolerance) {
    usageFail(
      'CLI_INCOMPLETE_BACKGROUND',
      'Options "--background" and "--tolerance" must be supplied together',
    );
  }

  if (positionals.length < 2) {
    usageFail('CLI_MISSING_PATHS', 'Convert requires a source path and an output path');
  }
  if (positionals.length > 2) {
    usageFail('CLI_EXTRA_PATHS', 'Convert accepts exactly a source path and an output path');
  }

  const background = sawBackground ? parseBackground(backgroundValue) : null;
  const tolerance = sawTolerance ? parseTolerance(toleranceValue) : null;

  return {
    help: false,
    json,
    overwrite,
    source: positionals[0],
    output: positionals[1],
    backgroundRemoval:
      background === null
        ? null
        : {
            color: background,
            tolerance,
          },
  };
}

export function verifyConvertedOutput(source, output, outputPath = 'output') {
  if (
    output === null ||
    typeof output !== 'object' ||
    output.width !== source.width ||
    output.height !== source.height
  ) {
    const actual =
      output && typeof output === 'object'
        ? `${output.width}x${output.height}`
        : 'unreadable';
    throw new CliPngError(
      'CLI_VERIFY_FAILED',
      `Converted output "${outputPath}" has dimensions ${actual}; expected ${source.width}x${source.height}`,
      { path: outputPath },
    );
  }

  let zero = 0;
  let full = 0;
  let intermediate = 0;

  for (let offset = 3; offset < output.pixels.length; offset += 4) {
    const alpha = output.pixels[offset];
    if (alpha === 0) zero += 1;
    else if (alpha === 255) full += 1;
    else intermediate += 1;
  }

  if (intermediate !== 0) {
    throw new CliPngError(
      'CLI_VERIFY_FAILED',
      `Converted output "${outputPath}" contains ${intermediate} intermediate alpha value(s)`,
      { path: outputPath },
    );
  }

  return { zero, full, intermediate };
}

function executeConvert(options, dependencies) {
  const read = dependencies.readPngFile ?? readPngFile;
  const write = dependencies.writePngFile ?? writePngFile;
  const remove = dependencies.removeUniformBackground ?? removeUniformBackground;
  const dither = dependencies.ditherAlphaBayer8 ?? ditherAlphaBayer8;
  const verify = dependencies.verifyConvertedOutput ?? verifyConvertedOutput;

  const sourceImage = read(options.source);
  let processed = sourceImage;

  if (options.backgroundRemoval !== null) {
    try {
      processed = remove(sourceImage, options.backgroundRemoval);
    } catch (error) {
      if (error instanceof BackgroundError) {
        throw new CliPngError(
          error.code,
          `Cannot remove background from "${options.source}": ${error.message}`,
          { cause: error, path: options.source },
        );
      }
      throw error;
    }
  }

  processed = dither(processed);
  write(processed, options.source, options.output, { overwrite: options.overwrite });

  let produced;
  try {
    produced = read(options.output);
  } catch (error) {
    if (error instanceof CliPngError) {
      throw new CliPngError(
        'CLI_VERIFY_FAILED',
        `Cannot reread PNG output "${options.output}": ${error.message}`,
        { cause: error, path: options.output },
      );
    }
    throw error;
  }

  const alpha = verify(sourceImage, produced, options.output);

  return {
    source: options.source,
    output: options.output,
    width: sourceImage.width,
    height: sourceImage.height,
    algorithm: 'bayer-8x8',
    backgroundRemoval:
      options.backgroundRemoval === null
        ? null
        : {
            color: { ...options.backgroundRemoval.color },
            tolerance: options.backgroundRemoval.tolerance,
          },
    alpha,
  };
}

function hexColor(color) {
  return `#${[color.red, color.green, color.blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function writeSuccess(io, json, result) {
  if (json) {
    io.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  const background =
    result.backgroundRemoval === null
      ? 'none'
      : `${hexColor(result.backgroundRemoval.color)} (tolerance ${result.backgroundRemoval.tolerance})`;

  const lines = [
    'Converted PNG',
    `Source: ${result.source}`,
    `Output: ${result.output}`,
    `Dimensions: ${result.width}x${result.height}`,
    `Algorithm: ${result.algorithm}`,
    `Background removal: ${background}`,
    `Alpha 0: ${result.alpha.zero}`,
    `Alpha 255: ${result.alpha.full}`,
    `Alpha intermediate: ${result.alpha.intermediate}`,
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
  io.stderr.write(`alpha-binary convert: ${code}: ${message}${location}\n`);
}

export function runConvertCommand(argv, io, dependencies = {}) {
  const jsonRequested = argv.includes('--json');
  let options;

  try {
    options = parseConvertArgs(argv);
  } catch (error) {
    if (error instanceof ConvertUsageError) {
      writeFailure(io, jsonRequested, error);
      return 2;
    }
    throw error;
  }

  if (options.help) {
    io.stdout.write(CONVERT_USAGE);
    return 0;
  }

  try {
    const result = executeConvert(options, dependencies);
    writeSuccess(io, options.json, result);
    return 0;
  } catch (error) {
    const diagnostic =
      error instanceof CliPngError || error instanceof BackgroundError
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
