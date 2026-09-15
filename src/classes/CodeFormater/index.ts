class CodeFormater {
  static indent(code: string, spaces: number): string {
    const prefix = " ".repeat(spaces);

    return code
      .trim()
      .split("\n")
      .map((line) => prefix + line)
      .join("\n");
  }
}

export default CodeFormater;
