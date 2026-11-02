import { randomBytes } from 'node:crypto';
import {
  closeSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { decodePng, encodePng, PngError } from '../core/index.js';

export class CliPngError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'CliPngError';
    this.code = code;
    if (options?.path) this.path = options.path;
  }
}

function fail(code, message, options) {
  throw new CliPngError(code, message, options);
}

function assertPath(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('CLI_INVALID_PATH', `${label} path must be a non-empty string`);
  }
}

function lstatIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function sourceIdentity(sourcePath) {
  let stats;
  try {
    stats = statSync(sourcePath);
  } catch (error) {
    fail('CLI_READ_FAILED', `Cannot read PNG source "${sourcePath}": ${error.message}`, {
      cause: error,
      path: sourcePath,
    });
  }

  return {
    path: sourcePath,
    resolved: resolve(sourcePath),
    real: realpathSync(sourcePath),
    stats,
  };
}

function assertOutputIsNotSource(source, outputPath, outputStats) {
  if (resolve(outputPath) === source.resolved) {
    fail('CLI_OUTPUT_IS_SOURCE', `Refusing to write output "${outputPath}" over its source`, {
      path: outputPath,
    });
  }

  if (outputStats && sameFile(source.stats, outputStats)) {
    fail('CLI_OUTPUT_IS_SOURCE', `Refusing to write output "${outputPath}" over its source`, {
      path: outputPath,
    });
  }

  const outputEntry = lstatIfPresent(outputPath);
  if (outputEntry?.isSymbolicLink()) {
    let target;
    try {
      target = realpathSync(outputPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return;
    }
    if (target === source.real) {
      fail('CLI_OUTPUT_IS_SOURCE', `Refusing to write output "${outputPath}" over its source`, {
        path: outputPath,
      });
    }
  }
}

function outputStatsIfPresent(outputPath) {
  const entry = lstatIfPresent(outputPath);
  if (!entry) return null;

  try {
    return statSync(outputPath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function writeNewOutput(data, outputPath) {
  let descriptor;
  try {
    descriptor = openSync(outputPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') {
      fail('CLI_OUTPUT_EXISTS', `Refusing to replace existing output "${outputPath}"`, {
        cause: error,
        path: outputPath,
      });
    }
    fail('CLI_WRITE_FAILED', `Cannot write PNG output "${outputPath}": ${error.message}`, {
      cause: error,
      path: outputPath,
    });
  }

  try {
    writeFileSync(descriptor, data);
    closeSync(descriptor);
  } catch (error) {
    try {
      closeSync(descriptor);
    } catch {
    }
    try {
      unlinkSync(outputPath);
    } catch {
    }
    fail('CLI_WRITE_FAILED', `Cannot write PNG output "${outputPath}": ${error.message}`, {
      cause: error,
      path: outputPath,
    });
  }
}

function createTemporaryOutput(outputPath) {
  const directory = dirname(outputPath);
  const name = basename(outputPath);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = randomBytes(8).toString('hex');
    const temporaryPath = join(directory, `.${name}.${process.pid}.${suffix}.tmp`);
    try {
      const descriptor = openSync(temporaryPath, 'wx');
      return { descriptor, path: temporaryPath };
    } catch (error) {
      if (error.code === 'EEXIST' && attempt < 4) continue;
      fail('CLI_WRITE_FAILED', `Cannot write PNG output "${outputPath}": ${error.message}`, {
        cause: error,
        path: outputPath,
      });
    }
  }

  fail('CLI_WRITE_FAILED', `Cannot create a temporary output for "${outputPath}"`, {
    path: outputPath,
  });
}

function replaceOutput(data, outputPath) {
  const temporary = createTemporaryOutput(outputPath);

  try {
    writeFileSync(temporary.descriptor, data);
    closeSync(temporary.descriptor);
    renameSync(temporary.path, outputPath);
  } catch (error) {
    try {
      closeSync(temporary.descriptor);
    } catch {
    }
    try {
      unlinkSync(temporary.path);
    } catch {
    }
    fail('CLI_WRITE_FAILED', `Cannot write PNG output "${outputPath}": ${error.message}`, {
      cause: error,
      path: outputPath,
    });
  }
}

export function readPngFile(sourcePath) {
  assertPath(sourcePath, 'Source');

  let bytes;
  try {
    bytes = readFileSync(sourcePath);
  } catch (error) {
    fail('CLI_READ_FAILED', `Cannot read PNG source "${sourcePath}": ${error.message}`, {
      cause: error,
      path: sourcePath,
    });
  }

  try {
    return decodePng(bytes);
  } catch (error) {
    if (error instanceof PngError) {
      fail(error.code, `Invalid PNG source "${sourcePath}": ${error.message}`, {
        cause: error,
        path: sourcePath,
      });
    }
    throw error;
  }
}

function normalizeWriteArguments(imageOrSource, sourceOrOutput, outputOrOptions, maybeOptions) {
  if (typeof imageOrSource === 'string') {
    return {
      image: readPngFile(imageOrSource),
      sourcePath: imageOrSource,
      outputPath: sourceOrOutput,
      options: typeof outputOrOptions === 'object' && outputOrOptions !== null
        ? outputOrOptions
        : {},
    };
  }

  return {
    image: imageOrSource,
    sourcePath: sourceOrOutput,
    outputPath: outputOrOptions,
    options: typeof maybeOptions === 'object' && maybeOptions !== null ? maybeOptions : {},
  };
}

export function writePngFile(imageOrSource, sourceOrOutput, outputOrOptions, maybeOptions) {
  const { image, sourcePath, outputPath, options } = normalizeWriteArguments(
    imageOrSource,
    sourceOrOutput,
    outputOrOptions,
    maybeOptions,
  );

  assertPath(sourcePath, 'Source');
  assertPath(outputPath, 'Output');

  let encoded;
  try {
    encoded = encodePng(image);
  } catch (error) {
    if (error instanceof PngError) {
      fail(error.code, `Cannot encode PNG output "${outputPath}": ${error.message}`, {
        cause: error,
        path: outputPath,
      });
    }
    throw error;
  }

  const source = sourceIdentity(sourcePath);
  const outputStats = outputStatsIfPresent(outputPath);
  assertOutputIsNotSource(source, outputPath, outputStats);

  if (outputStats && options.overwrite !== true) {
    fail('CLI_OUTPUT_EXISTS', `Refusing to replace existing output "${outputPath}"`, {
      path: outputPath,
    });
  }

  if (options.overwrite === true) {
    replaceOutput(encoded, outputPath);
  } else {
    writeNewOutput(encoded, outputPath);
  }

  return { path: outputPath, bytesWritten: encoded.length };
}

export const readPng = readPngFile;
export const writePng = writePngFile;