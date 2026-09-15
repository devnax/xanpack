import fs from "node:fs";
import path from "node:path";

class Generator {
  async generate(filePath: string, code: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    await fs.promises.writeFile(filePath, code, "utf8");
  }
}

export default Generator;
