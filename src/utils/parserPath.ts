import * as path from 'path';
import * as vscode from 'vscode';

// Trả về path tới CLI parser route
export function getParserPath(context: vscode.ExtensionContext): string {
    const bin = process.platform === 'win32' ? 'parse_routes.exe' : 'parse_routes';
    return path.join(context.extensionPath, 'route_parser', bin);
}
