import { runConvertCommand } from './convert.js';

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

const HELP = [
  'Usage: alpha-binary <command> [options]',
  '       alpha-binary convert <source.png> <output.png> [options]',
  '',
  'Commands:',
  '  convert   Convert a PNG to binary alpha transparency',
  '',
  'AlphaBinary converts PNG images to binary alpha transparency.',
  'Run "alpha-binary convert --help" for convert options.',
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

  write(io.stderr, `alpha-binary: unknown command '${argv[0]}'\n\n${HELP}`);
  return 2;
}
