#!/bin/bash

# cockpit-bridge --packages
# /usr/share/cockpit/diskio/
# ln -snf "$PWD" ~/.local/share/cockpit/diskio
# yum install sysstat

disk="$1"

detect_disk_type() {
  local disk="$1"

  # Калі nvme — адразу NVMe
  [[ "$disk" == nvme* ]] && echo "NVMe" && return

  # Калі rotational існуе
  if [[ -f "/sys/block/$disk/queue/rotational" ]]; then
    local rot
    rot=$(cat "/sys/block/$disk/queue/rotational")
    [[ "$rot" == "1" ]] && echo "HDD" || echo "SSD"
  else
    echo "Unknown"
  fi
}

# # Калі перададзены /dev/mapper/... — пераўтварыць у dm-X
# if [[ "$disk" == /dev/mapper/* ]]; then
#   disk=$(ls -l "$disk" | awk -F'-> ../' '{print $2}')
# fi

type=$(detect_disk_type "$disk")

LC_ALL=C sar -dp 1 1 | grep "Average:" | awk -v d="$disk" -v t="$type" '
BEGIN {
  found = 0
  headerParsed = 0
  # Ініцыялізуем усе пазіцыі як 0
  tps = rkb = wkb = arq = aqu = awt = svctm = util = dev = 0
}

# Загалоўкі: вызначаем пазіцыі слупкоў
/^Average:/ && /DEV/ {
  for (i = 1; i <= NF; i++) {
    if ($i == "tps")      tps = i
    if ($i == "rkB/s")    rkb = i
    if ($i == "wkB/s")    wkb = i
    if ($i == "areq-sz")  arq = i
    if ($i == "aqu-sz")   aqu = i
    if ($i == "await")    awt = i
    if ($i == "svctm")    svctm = i
    if ($i == "%util")    util = i
    if ($i == "DEV")      dev = i
  }
  headerParsed = 1
  next
}

# Даныя: шукаем радок, дзе любы слупок роўны d
headerParsed && /^Average:/ {
  for (i = 1; i <= NF; i++) {
    if ($i == d) {
      found = 1
      print "{"
      print "\"disk\":\"" d "\","
      print "\"type\":\"" t "\","
      print "\"tps\":" (tps     ? $(tps)   : 0) ","
      print "\"rd_sec_per_s\":" (rkb     ? $(rkb)   : 0) ","
      print "\"wr_sec_per_s\":" (wkb     ? $(wkb)   : 0) ","
      print "\"avgrq_sz\":"     (arq     ? $(arq)   : 0) ","
      print "\"avgqu_sz\":"     (aqu     ? $(aqu)   : 0) ","
      print "\"await\":"        (awt     ? $(awt)   : 0) ","
      print "\"svctm\":"        (svctm   ? $(svctm) : 0) ","
      print "\"util\":"         (util    ? $(util)  : 0)
      print "}"
      exit
    }
  }
}

END {
  if (!found) {
    print "{\"error\":\"Не знойдзены радок для " d "\"}"
  }
}
'
