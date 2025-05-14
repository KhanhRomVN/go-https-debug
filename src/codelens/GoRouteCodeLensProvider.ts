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

        return routes.map(route => {
            const position = new vscode.Position(route.line - 1, 0);
            return new vscode.CodeLens(
                new vscode.Range(position, position),
                {
                    title: this.composeLensTitle(route),
                    tooltip: 'Click để xem chi tiết route',
                    command: 'goRouteExtension.codelensAction',
                    arguments: [route]
                }
            );
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

    private composeLensTitle(route: Route): string {
        return `👋 ${route.method} ${route.path}   [request body]  [baerer]  [run]`;
    }
}
