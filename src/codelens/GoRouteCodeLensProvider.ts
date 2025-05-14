import * as vscode from 'vscode';
import * as cp from 'child_process';
import { getParserPath } from '../utils/parserPath';

export interface Route {
    method: string;
    path: string;
    line: number;
}

export class GoRouteCodeLensProvider implements vscode.CodeLensProvider {
    constructor(private context: vscode.ExtensionContext) { }

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const parserPath = getParserPath(this.context);
        const filePath = document.uri.fsPath;
        let routes: Route[] = [];
        try {
            routes = await this.parseRoutes(parserPath, filePath);
        } catch {
            // ignore
        }
        return routes.flatMap(route => {
            const position = new vscode.Position(route.line - 1, 0);
            // Tạo 3 CodeLens riêng biệt cho mỗi chức năng
            return [
                new vscode.CodeLens(new vscode.Range(position, position), {
                    title: '[request body]',
                    tooltip: 'Nhập raw JSON request body cho route này',
                    command: 'goRouteExtension.setRequestBody',
                    arguments: [route]
                }),
                new vscode.CodeLens(new vscode.Range(position, position), {
                    title: '[baerer]',
                    tooltip: 'Nhập baerer token dùng cho tất cả route',
                    command: 'goRouteExtension.setBaerer'
                }),
                new vscode.CodeLens(new vscode.Range(position, position), {
                    title: '[run]',
                    tooltip: 'Chạy HTTP request này',
                    command: 'goRouteExtension.runRoute',
                    arguments: [route]
                }),
            ];
        });
    }

    private async parseRoutes(parserPath: string, filePath: string): Promise<Route[]> {
        return new Promise(resolve => {
            cp.execFile(parserPath, [filePath], { timeout: 4000 }, (err, stdout) => {
                if (err) return resolve([]);
                try {
                    resolve(JSON.parse(stdout));
                } catch {
                    resolve([]);
                }
            });
        });
    }
}
