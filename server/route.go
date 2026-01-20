package server

import (
	"fmt"
	"github.com/gofiber/fiber/v2"
)

var Counter int = 0

type Ret struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   int    `json:"code"`
	Data    any    `json:"data"`
}
func cret(Success bool, Message string, Data any) Ret {
	Counter += 1
	return Ret{ Success, Message, Counter - 1, Data }
}

func resp(c *fiber.Ctx, ret Ret) error {
	return c.Status(fiber.StatusBadRequest).JSON(ret)
}

func SetupRoot(s *Server) {
	s.App.Get("/", func (c *fiber.Ctx) error {
		return c.SendString("Server is online")
	})

}

func SetupRegister(_ *Server, group fiber.Router) {
	group.Post("/register", func (c *fiber.Ctx) error {
		var b struct {
			Username string `json:"username"`
			Password string `json:"password"`
		};

        err:= c.BodyParser(&b)
        if err != nil {
            return resp(c, cret(false, fmt.Sprintf("%v", err), nil))
        }

		test := len(b.Username) <= 0
		if test { return resp(c, cret(false, "UserName is empty", nil)) }
		test = len(b.Password) <= 0
		if test { return resp(c, cret(false, "Password is empty", nil)) }

		return resp(c, cret(true, "WIP", nil))
	})
}

func SetupLogin(_ *Server, group fiber.Router) {
	group.Post("/login", func (c *fiber.Ctx) error {
		return c.SendString("WIP")
	})
}
