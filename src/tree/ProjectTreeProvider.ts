import * as vscode from 'vscode';
import { getAllProjectRoots } from '../utils/findProjects';
import { getRoutesForProject } from '../utils/getRoutesForProject';
import { Route } from '../codelens/GoRouteCodeLensProvider';
import * as path from 'path';

// HTTP method icon map
const methodIcons: Record<string, vscode.ThemeIcon> = {
    GET: new vscode.ThemeIcon('arrow-circle-right', new vscode.ThemeColor('charts.green')),
    POST: new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.blue')),
    PUT: new vscode.ThemeIcon('edit', new vscode.ThemeColor('charts.yellow')),
    DELETE: new vscode.ThemeIcon('trash', new vscode.ThemeColor('charts.red')),
    PATCH: new vscode.ThemeIcon('wrench', new vscode.ThemeColor('charts.blue')),
    OPTIONS: new vscode.ThemeIcon('question', new vscode.ThemeColor('charts.purple')),
    HEAD: new vscode.ThemeIcon('chevron-up', new vscode.ThemeColor('charts.yellow')),
};

// Tree Item: Route Node
class RouteTreeItem extends vscode.TreeItem {
    constructor(
        public readonly route: Route,
        public readonly filePath: string
    ) {
        super(`${route.method} ${route.path}`, vscode.TreeItemCollapsibleState.None);
        this.description = `Line ${route.line}`;
        this.iconPath = methodIcons[route.method] || new vscode.ThemeIcon('arrow-right');
        this.contextValue = 'route';
        this.tooltip = `${route.method} ${route.path}\nFile: ${path.basename(filePath)}:${route.line}`;
        this.command = {
            command: 'gohbSidebar.moveToRoute',
            title: 'Go to route',
            arguments: [filePath, route.line]
        };
    }
}

// Tree Item: Resource Group (user, developer, ...)
class ResourceGroupTreeItem extends vscode.TreeItem {
    children: RouteTreeItem[] = [];
    constructor(public readonly name: string) {
        super(name, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'resourceGroup';
        this.iconPath = new vscode.ThemeIcon('folder');
    }
}

// Tree Item: Each Go file node
class FileTreeItem extends vscode.TreeItem {
    constructor(label: string, public resources: ResourceGroupTreeItem[]) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('file-code');
        this.contextValue = 'fileGroup';
    }
}

// Tree Item: Project node
class ProjectTreeItem extends vscode.TreeItem {
    constructor(label: string, public fullPath: string) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('folder-library');
        this.tooltip = fullPath;
        this.contextValue = 'projectRoot';
    }
}

// Group routes theo resource
function getResourceGroupKey(rawPath: string, filePath: string): string {
    const segments = rawPath
        .replace(/(^['"]|['"]$)/g, '')
        .split('/')
        .filter(seg => !!seg && !seg.startsWith(':'));
    // Nếu group key rỗng (root "/"), dùng tên file
    if (!segments[0]) {
        // filePath = ".../course_routes.go"
        const base = path.basename(filePath, '.go');
        return base.replace('_routes', ''); // course_routes.go => "course"
    }
    return segments[0];
}

function groupByResource(
    routes: { route: Route; file: string }[]
): ResourceGroupTreeItem[] {
    const resourceMap: Record<string, RouteTreeItem[]> = {};
    for (const r of routes) {
        const resource = getResourceGroupKey(r.route.path, r.file);
        if (!resourceMap[resource]) resourceMap[resource] = [];
        resourceMap[resource].push(new RouteTreeItem(r.route, r.file));
    }
    return Object.keys(resourceMap)
        .sort()
        .map(res => {
            const item = new ResourceGroupTreeItem(res);
            item.children = resourceMap[res].sort((a, b) =>
                a.route.method === b.route.method
                    ? a.route.path.localeCompare(b.route.path)
                    : a.route.method.localeCompare(b.route.method)
            );
            return item;
        });
}

export class ProjectTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private projects: {
        label: string;
        fullPath: string;
        files: FileTreeItem[];
    }[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.refresh();
    }

    async refresh() {
        this.projects = [];
        const projectRoots = await getAllProjectRoots();
        for (const projectFullPath of projectRoots) {
            const label = vscode.workspace.asRelativePath(projectFullPath);
            const rawRoutes = await getRoutesForProject(projectFullPath, this.context);

            const byFile: Record<string, { route: Route; file: string }[]> = {};
            for (const r of rawRoutes) {
                const { __file, ...pureRoute } = r as any;
                if (!byFile[__file]) byFile[__file] = [];
                byFile[__file].push({ route: pureRoute as Route, file: __file });
            }
            const files: FileTreeItem[] = [];
            for (const filePath of Object.keys(byFile).sort()) {
                const fileLabel = path.basename(filePath);
                files.push(new FileTreeItem(fileLabel, groupByResource(byFile[filePath])));
            }
            this.projects.push({ label, fullPath: projectFullPath, files });
        }
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!element) {
            // Project roots
            return this.projects.map((proj) => new ProjectTreeItem(proj.label, proj.fullPath));
        }
        if (element instanceof ProjectTreeItem) {
            // Go files in project
            const proj = this.projects.find((p) => p.fullPath === element.fullPath);
            return proj ? proj.files : [];
        }
        if (element instanceof FileTreeItem) {
            // Resource group in file
            return element.resources;
        }
        if (element instanceof ResourceGroupTreeItem) {
            // Routes under resource
            return element.children;
        }
        // Route cuối không có con
        return [];
    }
}
