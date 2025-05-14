package main

import (
	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.New()
	api := r.Group("/v1")
	user := api.Group("/user")
	user.GET("/register", nil)
}
