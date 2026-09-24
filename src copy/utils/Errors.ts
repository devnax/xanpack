export class XanpackError extends Error {
  cause?: Error;

  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "XanpackError";
  }
}

export class ResolveError extends XanpackError {
  constructor(source: string, importer: string) {
    super(
      `Failed to resolve module "${source}" from "${importer}"`,
      "RESOLVE_ERROR",
    );
  }
}

export class CircularDependencyError extends XanpackError {
  constructor(chain: string[]) {
    super(
      `Circular dependency detected: ${chain.join(" -> ")}`,
      "CIRCULAR_DEPENDENCY",
    );
  }
}

export class ConfigError extends XanpackError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
  }
}

export class TransformError extends XanpackError {
  constructor(filePath: string, originalError: Error) {
    super(
      `Failed to transform "${filePath}": ${originalError.message}`,
      "TRANSFORM_ERROR",
    );
    this.cause = originalError;
  }
}

export class ParseError extends XanpackError {
  constructor(filePath: string, originalError: Error) {
    super(
      `Failed to parse "${filePath}": ${originalError.message}`,
      "PARSE_ERROR",
    );
    this.cause = originalError;
  }
}
