import * as vscode from 'vscode';
import * as cp from 'child_process';
import { getParserPath } from './parserPath';
import { Route } from '../codelens/GoRouteCodeLensProvider';

export async function getRoutesForProject(projectRoot: string, context: vscode.ExtensionContext): Promise<(Route & { __file: string })[]> {
    const goFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(projectRoot, '**/*.go'),
        '**/{vendor,node_modules,.git}/**'
    );
    const parserPath = getParserPath(context);
    let routes: (Route & { __file: string })[] = [];
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
            routes.push(...fileRoutes.map(r => ({ ...r, __file: file.fsPath })));
        } catch {/* ignore file error */ }
    }
    return routes;
}
