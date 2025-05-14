import * as vscode from 'vscode';
import * as cp from 'child_process';
import { getParserPath } from './parserPath';
import { Route } from '../codelens/GoRouteCodeLensProvider';

// Lấy tất cả route thực sự trong projectRoot
export async function getRoutesForProject(projectRoot: string, context: vscode.ExtensionContext): Promise<Route[]> {
    const goFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(projectRoot, '**/*.go'),
        '**/{vendor,node_modules,.git}/**'
    );
    const parserPath = getParserPath(context);

    let routes: Route[] = [];
    for (const file of goFiles) {
        try {
            const fileRoutes: Route[] = await new Promise(resolve => {
                cp.execFile(parserPath, [file.fsPath], { timeout: 4000 }, (err, stdout) => {
                    if (err) return resolve([]);
                    try {
                        resolve(JSON.parse(stdout));
                    } catch {
                        resolve([]);
                    }
                });
            });
            routes.push(...fileRoutes);
        } catch {/* ignore file error */ }
    }
    return routes;
}
