package helper

import (
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
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

func GenerateChallenge() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(b), nil
}

func VerifySignature(pubKeyBase64, messageBase64, sigBase64 string) (bool, error) {
	pubKey, err := base64.StdEncoding.DecodeString(pubKeyBase64)
	if err != nil || len(pubKey) != ed25519.PublicKeySize {
		return false, errors.New("invalid public key")
	}

	message, err := base64.StdEncoding.DecodeString(messageBase64)
	if err != nil {
		return false, errors.New("invalid message")
	}

	sig, err := base64.StdEncoding.DecodeString(sigBase64)
	if err != nil {
		return false, errors.New("invalid signature")
	}

	return ed25519.Verify(pubKey, message, sig), nil
}

func GetJWT(c *fiber.Ctx) (jwt.MapClaims, error) {
    user := c.Locals("user").(*jwt.Token)
    if user == nil {
        return nil, errors.New("JWT token not valid")
    }
    if !user.Valid {
        return nil, errors.New("JWT token expired")
    }
    claims := user.Claims.(jwt.MapClaims)
    return claims, nil
}
