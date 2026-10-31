const HELP = [
  'Usage: alpha-binary [--help]',
  '',
  'AlphaBinary converts PNG images to binary alpha transparency.',
  'Only help is available in this build.',
  '',
].join('\n');

function write(stream, text) {
  stream.write(text);
}

export function main(argv, io) {
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    write(io.stdout, HELP);
    return 0;
  }

  write(io.stderr, `alpha-binary: unknown command '${argv[0]}'\n\n${HELP}`);
  return 2;
}
