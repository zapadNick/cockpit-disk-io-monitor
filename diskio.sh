#!/bin/bash

# yum install sysstat
# ln -snf "$PWD" ~/.local/share/cockpit/diskio

sector_csv=""

# Збіраем sector size для mapper-прылад
while IFS= read -r line; do
  mapper_name=$(echo "$line" | awk '{print $9}')
  dm_target=$(echo "$line" | awk '{print $NF}' | sed 's|\.\./||')

  [[ "$dm_target" != dm-* ]] && continue

  ss=$(blockdev --getss "/dev/$dm_target" 2>/dev/null || echo 512)
  sector_csv+="$mapper_name:$ss,"
done < <(ls -l /dev/mapper)

# Дадаем фізічныя прылады
while IFS= read -r disk; do
  ss=$(blockdev --getss "/dev/$disk" 2>/dev/null || echo 512)
  sector_csv+="$disk:$ss,"
done < <(lsblk -dn -o NAME | grep -v '^loop')

sector_csv="${sector_csv%,}"
# echo ${sector_csv[@]}

# Запускаем sar
LC_ALL=C sar -dp 1 1 | grep "^Average:" | grep -v loop | awk -v sector_csv="$sector_csv" '
BEGIN {
  split(sector_csv, pairs, ",")
  for (i in pairs) {
    split(pairs[i], kv, ":")
    sectors[kv[1]] = kv[2]
  }

  headerParsed = 0
  print "{"
  first = 1
}

/^Average:/ && $0 ~ /DEV/ {
  for (i = 1; i <= NF; i++) {
    if ($i == "tps")        tps = i
    if ($i == "rkB/s")      rkb = i
    if ($i == "wkB/s")      wkb = i
    if ($i == "rd_sec/s")   rdsec = i
    if ($i == "wr_sec/s")   wrsec = i
    if ($i == "areq-sz")    arq = i
    if ($i == "aqu-sz")     aqu = i
    if ($i == "await")      awt = i
    if ($i == "svctm")      svctm = i
    if ($i == "%util")      util = i
    if ($i == "DEV")        dev = i
  }
  headerParsed = 1
  next
}

headerParsed && /^Average:/ {
  disk = $(dev)
  ss = sectors[disk] + 0

  read_kb  = (rkb ? $(rkb) : (rdsec ? $(rdsec) * ss / 1024 : -1))
  write_kb = (wkb ? $(wkb) : (wrsec ? $(wrsec) * ss / 1024 : -1))

  if (!first) print ","
  first = 0

  print "\"" disk "\": {"
  print "\"tps\":" (tps     ? $(tps)   : 0) ","
  print "\"read_kB_per_s\":"  read_kb ","
  print "\"write_kB_per_s\":" write_kb ","
  print "\"avgrq_sz\":"     (arq     ? $(arq)   : 0) ","
  print "\"avgqu_sz\":"     (aqu     ? $(aqu)   : 0) ","
  print "\"await\":"        (awt     ? $(awt)   : 0) ","
  print "\"svctm\":"        (svctm   ? $(svctm) : 0) ","
  print "\"util\":"         (util    ? $(util)  : 0)
  print "}"
}

END {
  print "}"
}
'
