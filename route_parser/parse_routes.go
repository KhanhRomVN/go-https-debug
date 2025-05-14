package main

import (
	"encoding/json"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"regexp"
	"strings"
)

type Route struct {
	Method string `json:"method"`
	Path   string `json:"path"`
	Line   int    `json:"line"`
}

var methods = regexp.MustCompile(`^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)$`)

// Scope to track variable -> group prefix
type scope struct {
	prefixes map[string]string
	parent   *scope
}

func newScope(parent *scope) *scope {
	return &scope{prefixes: map[string]string{}, parent: parent}
}
func getPrefix(s *scope, name string) string {
	for cur := s; cur != nil; cur = cur.parent {
		if pf, ok := cur.prefixes[name]; ok {
			return pf
		}
	}
	return ""
}

func main() {
	if len(os.Args) < 2 {
		os.Exit(1)
	}
	filename := os.Args[1]
	fs := token.NewFileSet()
	node, err := parser.ParseFile(fs, filename, nil, parser.AllErrors)
	if err != nil {
		os.Exit(1)
	}
	var routes []Route

	var inspectFunc func(ast.Node, *scope)
	inspectFunc = func(n ast.Node, s *scope) {
		if n == nil {
			return
		}
		// Group assign: user := api.Group("/user")
		if assign, ok := n.(*ast.AssignStmt); ok {
			for i, rhs := range assign.Rhs {
				if call, ok := rhs.(*ast.CallExpr); ok {
					if sel, ok := call.Fun.(*ast.SelectorExpr); ok && sel.Sel.Name == "Group" {
						if len(call.Args) > 0 {
							if bl, ok := call.Args[0].(*ast.BasicLit); ok && bl.Kind.String() == "STRING" {
								if ident, ok := assign.Lhs[i].(*ast.Ident); ok {
									prefix := ""
									if recv, ok := sel.X.(*ast.Ident); ok {
										prefix = getPrefix(s, recv.Name)
									}
									s.prefixes[ident.Name] = joinPath(prefix, trimQuotes(bl.Value))
								}
							}
						}
					}
				}
			}
		}
		// Route handler: user.POST("/register", ...)
		if expr, ok := n.(*ast.ExprStmt); ok {
			if call, ok := expr.X.(*ast.CallExpr); ok {
				if sel, ok := call.Fun.(*ast.SelectorExpr); ok && methods.MatchString(sel.Sel.Name) {
					recvName := ""
					if ident, ok := sel.X.(*ast.Ident); ok {
						recvName = ident.Name
					}
					prefix := getPrefix(s, recvName)
					path := ""
					if len(call.Args) > 0 {
						if bl, ok := call.Args[0].(*ast.BasicLit); ok && bl.Kind.String() == "STRING" {
							path = trimQuotes(bl.Value)
						}
					}
					line := fs.Position(call.Pos()).Line
					fullPath := joinPath(prefix, path)
					routes = append(routes, Route{
						Method: sel.Sel.Name,
						Path:   fullPath,
						Line:   line,
					})
				}
			}
		}
		// Đệ quy depth-first vào các node con (quản lý scope cho block)
		switch t := n.(type) {
		case *ast.BlockStmt:
			childScope := newScope(s)
			for _, stmt := range t.List {
				inspectFunc(stmt, childScope)
			}
		case *ast.File:
			for _, decl := range t.Decls {
				inspectFunc(decl, s)
			}
		case *ast.FuncDecl:
			inspectFunc(t.Body, s)
		case *ast.IfStmt:
			inspectFunc(t.Init, s)
			inspectFunc(t.Cond, s)
			inspectFunc(t.Body, s)
			inspectFunc(t.Else, s)
		case *ast.ForStmt:
			inspectFunc(t.Init, s)
			inspectFunc(t.Cond, s)
			inspectFunc(t.Post, s)
			inspectFunc(t.Body, s)
		case *ast.RangeStmt:
			inspectFunc(t.Key, s)
			inspectFunc(t.Value, s)
			inspectFunc(t.X, s)
			inspectFunc(t.Body, s)
		}
	}

	globalScope := newScope(nil)
	inspectFunc(node, globalScope)
	if len(routes) == 0 {
		os.Stdout.Write([]byte("[]"))
	} else {
		_ = json.NewEncoder(os.Stdout).Encode(routes)
	}
}

func trimQuotes(s string) string {
	return strings.Trim(s, "\"`'")
}
func joinPath(a, b string) string {
	a = strings.TrimRight(a, "/")
	b = strings.TrimLeft(b, "/")
	if a == "" {
		return "/" + b
	}
	if b == "" {
		return a
	}
	return a + "/" + b
}
