// parse_routes.go
package main

import (
	"encoding/json"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"regexp"
)

type Route struct {
	Method string `json:"method"`
	Path   string `json:"path"`
	Line   int    `json:"line"`
}

var methods = regexp.MustCompile(`^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)$`)

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
	ast.Inspect(node, func(n ast.Node) bool {
		call, ok := n.(*ast.CallExpr)
		if !ok {
			return true
		}
		sel, ok := call.Fun.(*ast.SelectorExpr)
		if !ok || !methods.MatchString(sel.Sel.Name) {
			return true
		}
		path := ""
		if len(call.Args) > 0 {
			if bl, ok := call.Args[0].(*ast.BasicLit); ok && bl.Kind.String() == "STRING" {
				path = bl.Value
			}
		}
		line := fs.Position(call.Pos()).Line
		routes = append(routes, Route{
			Method: sel.Sel.Name,
			Path:   path,
			Line:   line,
		})
		return true
	})
	_ = json.NewEncoder(os.Stdout).Encode(routes)
}
