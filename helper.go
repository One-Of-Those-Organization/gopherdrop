package main

import (
	"os"
)

type GoDropConfig struct {
	Url      string
	DBPath   string
    Password string
}

func getConfigFromEnv() GoDropConfig {
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
