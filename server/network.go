package server

import (
	"os/exec"
	"runtime"
	"strings"
)

// NetworkInfo contains information about the current network connection
type NetworkInfo struct {
	SSID      string `json:"ssid"`
	Connected bool   `json:"connected"`
}

// GetCurrentSSID returns the SSID of the currently connected WiFi network
func GetCurrentSSID() NetworkInfo {
	switch runtime.GOOS {
	case "windows":
		return getWindowsSSID()
	case "darwin":
		return getMacSSID()
	case "linux":
		return getLinuxSSID()
	default:
		return NetworkInfo{SSID: "Unknown", Connected: false}
	}
}

// getWindowsSSID gets SSID on Windows using netsh command
func getWindowsSSID() NetworkInfo {
	cmd := exec.Command("netsh", "wlan", "show", "interfaces")
	output, err := cmd.Output()
	if err != nil {
		return NetworkInfo{SSID: "Not Connected", Connected: false}
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		// Look for "SSID" but not "BSSID"
		if strings.HasPrefix(line, "SSID") && !strings.HasPrefix(line, "BSSID") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				ssid := strings.TrimSpace(parts[1])
				if ssid != "" {
					return NetworkInfo{SSID: ssid, Connected: true}
				}
			}
		}
	}

	return NetworkInfo{SSID: "Not Connected", Connected: false}
}

// getMacSSID gets SSID on macOS using airport command
func getMacSSID() NetworkInfo {
	cmd := exec.Command("/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport", "-I")
	output, err := cmd.Output()
	if err != nil {
		return NetworkInfo{SSID: "Not Connected", Connected: false}
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "SSID:") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				ssid := strings.TrimSpace(parts[1])
				if ssid != "" {
					return NetworkInfo{SSID: ssid, Connected: true}
				}
			}
		}
	}

	return NetworkInfo{SSID: "Not Connected", Connected: false}
}

// getLinuxSSID gets SSID on Linux using nmcli or iwgetid
func getLinuxSSID() NetworkInfo {
	// Try nmcli first
	cmd := exec.Command("nmcli", "-t", "-f", "active,ssid", "dev", "wifi")
	output, err := cmd.Output()
	if err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "yes:") {
				ssid := strings.TrimPrefix(line, "yes:")
				if ssid != "" {
					return NetworkInfo{SSID: ssid, Connected: true}
				}
			}
		}
	}

	// Fallback to iwgetid
	cmd = exec.Command("iwgetid", "-r")
	output, err = cmd.Output()
	if err == nil {
		ssid := strings.TrimSpace(string(output))
		if ssid != "" {
			return NetworkInfo{SSID: ssid, Connected: true}
		}
	}

	return NetworkInfo{SSID: "Not Connected", Connected: false}
}
