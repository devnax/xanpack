import { XanpackOption } from "../types.js";
import { ConfigError } from "./Errors.js";

export class ConfigValidator {
  static validate(option: XanpackOption): void {
    // Validate input
    if (!option.input) {
      throw new ConfigError("Missing required option: input");
    }

    if (
      typeof option.input !== "string" &&
      !Array.isArray(option.input) &&
      typeof option.input !== "object"
    ) {
      throw new ConfigError(
        "Invalid option.input: must be a string, array, or object",
      );
    }

    // Validate output
    if (!option.output) {
      throw new ConfigError("Missing required option: output");
    }

    if (typeof option.output !== "object") {
      throw new ConfigError("Invalid option.output: must be an object");
    }

    if (!option.output.dir) {
      throw new ConfigError("Missing required option: output.dir");
    }

    if (
      option.output.format &&
      !["esm", "cjs"].includes(option.output.format)
    ) {
      throw new ConfigError(
        'Invalid option.output.format: must be "esm" or "cjs"',
      );
    }

    // Validate transform options
    if (option.transform) {
      if (
        option.transform.define &&
        typeof option.transform.define !== "object"
      ) {
        throw new ConfigError(
          "Invalid option.transform.define: must be an object",
        );
      }
    }

    // Validate plugins
    if (option.plugins && !Array.isArray(option.plugins)) {
      throw new ConfigError("Invalid option.plugins: must be an array");
    }
  }
}

export default ConfigValidator;
