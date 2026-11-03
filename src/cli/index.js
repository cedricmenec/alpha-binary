import { runConvertCommand } from './convert.js';
import { runInspectCommand } from './inspect.js';

export {
  CliPngError,
  readPng,
  readPngFile,
  writePng,
  writePngFile,
} from './png-files.js';
export {
  CONVERT_USAGE,
  ConvertUsageError,
  parseConvertArgs,
  runConvertCommand,
  verifyConvertedOutput,
} from './convert.js';
export {
  INSPECT_USAGE,
  InspectUsageError,
  parseInspectArgs,
  runInspectCommand,
} from './inspect.js';

const HELP = [
  'Usage: alpha-binary <command> [options]',
  '       alpha-binary convert <source.png> <output.png> [options]',
  '       alpha-binary inspect <source.png> [options]',
  '',
  'Commands:',
  '  convert   Convert a PNG to binary alpha transparency',
  '  inspect   Analyse PNG alpha metrics without writing the source',
  '',
  'AlphaBinary converts PNG images to binary alpha transparency.',
  'Run "alpha-binary convert --help" for convert options.',
  'Run "alpha-binary inspect --help" for inspect options.',
  '',
].join('\n');

function write(stream, text) {
  stream.write(text);
}

export function main(argv, io, dependencies) {
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    write(io.stdout, HELP);
    return 0;
  }

  if (argv[0] === 'convert') {
    return runConvertCommand(argv.slice(1), io, dependencies);
  }

  if (argv[0] === 'inspect') {
    return runInspectCommand(argv.slice(1), io, dependencies);
  }

  write(io.stderr, `alpha-binary: unknown command '${argv[0]}'\n\n${HELP}`);
  return 2;
}
