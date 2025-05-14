import * as vscode from 'vscode';
import { GoRouteCodeLensProvider, Route } from './codelens/GoRouteCodeLensProvider';
import { ProjectTreeProvider } from './tree/ProjectTreeProvider';

const getRequestBodyKey = (route: Route) => `requestBody:${route.method}:${route.path}`;

/**
 * Hàm kích hoạt extension
 */
export function activate(context: vscode.ExtensionContext) {
    // ====== Codelens cho từng route ======
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider('go', new GoRouteCodeLensProvider(context))
    );

    // [request body]
    context.subscriptions.push(
        vscode.commands.registerCommand('goRouteExtension.setRequestBody', async (route: Route) => {
            const currentBody = context.workspaceState.get<string>(getRequestBodyKey(route)) || '';
            const json = await vscode.window.showInputBox({
                title: 'Request Body',
                placeHolder: '{"key": "value"}',
                prompt: 'Nhập raw JSON request body cho route',
                value: currentBody,
                validateInput: input => {
                    try { JSON.parse(input); return null; }
                    catch { return 'Invalid JSON'; }
                }
            });
            if (json !== undefined) {
                context.workspaceState.update(getRequestBodyKey(route), json);
                vscode.window.showInformationMessage('Đã lưu request body!');
            }
        }),
    );

    // [baerer]
    context.subscriptions.push(
        vscode.commands.registerCommand('goRouteExtension.setBaerer', async () => {
            const baerer = context.globalState.get<string>('baererToken') || '';
            const token = await vscode.window.showInputBox({
                title: 'Baerer Token',
                placeHolder: 'Bearer eyJhbGciOi...',
                prompt: 'Nhập baerer token cho tất cả route',
                value: baerer
            });
            if (token !== undefined) {
                context.globalState.update('baererToken', token);
                vscode.window.showInformationMessage('Đã lưu baerer token!');
            }
        }),
    );

    // [run]
    context.subscriptions.push(
        vscode.commands.registerCommand('goRouteExtension.runRoute', async (route: Route) => {
            const body = context.workspaceState.get<string>(getRequestBodyKey(route)) || '';
            const baerer = context.globalState.get<string>('baererToken') || '';

            if (!baerer) {
                vscode.window.showWarningMessage('Bạn cần nhập baerer token trước!');
                return;
            }

            try {
                const apiHost = vscode.workspace.getConfiguration().get<string>('goRouteExtension.apiHost') || 'http://localhost:8080';
                const url = `${apiHost}${route.path}`;

                // Sử dụng fetch động để tránh lỗi khi build extension
                const fetch = (await import('node-fetch')).default as typeof import('node-fetch')['default'];
                const res = await fetch(url, {
                    method: route.method.toUpperCase(),
                    headers: {
                        'Authorization': `Bearer ${baerer}`,
                        'Content-Type': 'application/json'
                    },
                    body: ['POST', 'PUT', 'PATCH'].includes(route.method.toUpperCase()) ? body : undefined
                });
                const text = await res.text();

                vscode.window.showInformationMessage(`Status: ${res.status} | Body: ${text.slice(0, 200)}...`, { modal: true });
            } catch (err: any) {
                vscode.window.showErrorMessage(`Lỗi khi request: ${err.message || err}`);
            }
        })
    );

    // ---- GOHB Sidebar ----
    // Đăng ký provider cho Sidebar Projects & Routes
    const gohbTreeProvider = new ProjectTreeProvider(context);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('gohbProjectRoutes', gohbTreeProvider)
    );
    // Đăng ký command để refresh sidebar
    context.subscriptions.push(
        vscode.commands.registerCommand('gohbSidebar.moveToRoute', async (filePath: string, line: number) => {
            const doc = await vscode.workspace.openTextDocument(filePath);
            const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
            const pos = new vscode.Position(line - 1, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        })
    );
    // Để sau này muốn thêm RUN chỉ cần:
    context.subscriptions.push(
        vscode.commands.registerCommand('gohbSidebar.runRoute', (route: Route) => {
            vscode.window.showInformationMessage('Run not implemented yet!');
        })
    );
}

/**
 * Khi extension tắt
 */
export function deactivate() { }
