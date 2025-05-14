import * as vscode from 'vscode';
import * as path from 'path';

// Trả về: mảng các folder chứa main.go trực tiếp (không parent!)
export async function getAllProjectRoots(): Promise<string[]> {
    const mainGos = await vscode.workspace.findFiles('**/main.go', '**/{vendor,node_modules,.git}/**');
    const dirs = new Set<string>();
    for (const file of mainGos) {
        dirs.add(path.dirname(file.fsPath));
    }
    return Array.from(dirs);
}
