package helper

import (
	"fmt"
	"encoding/base64"
	"errors"
	"math/rand"
	"golang.org/x/crypto/bcrypt"
	"os"
)

const letterBytes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"

type GoDropConfig struct {
	Url      string
	DBPath   string
    Password string
}

func GetConfigFromEnv() GoDropConfig {
    password := os.Getenv("GDROP_SECRET")
    if password == "" {
        password = "secret"
    }
    url := os.Getenv("GDROP_URL")
    if url == "" {
        url = "0.0.0.0:8080"
    }
    dbpath := os.Getenv("GDROP_DBPATH")
    if dbpath == "" {
        dbpath = "./db/data.db"
    }
    sec := GoDropConfig{
		Url: url,
        Password: password,
    }
    return sec
}
func WrapBase64(value string) string {
    str := base64.StdEncoding.EncodeToString([]byte(value))
    return str
}

func CreateRandomString(n int) (string, error) {
    if n <= 0 {
        return "", errors.New("invalid OTP len requested.")
    }

    b := make([]byte, n)
	max := len(letterBytes)
	min := 0
    for i := range b {
        num := rand.Intn(max - min) + min
        b[i] = letterBytes[num]
    }
    result := string(b)
	return result, nil
}

func HashPassword(password string) (string, error) {
    // The cost parameter determines how computationally expensive the hash is to calculate
    // The default is 10, but you can increase it for better security (at the cost of performance)
    hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    if err != nil {
        return "", errors.New(fmt.Sprintf("Failed to hash password: %v", err))
    }
    return string(hashedBytes), nil
}
