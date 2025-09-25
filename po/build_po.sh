#!/bin/bash
set -e

echo "window._translations = {" > ../translations.js

for po in *.po; do
  lang="${po%.po}"
  tmp="tmp-$lang.js"

  ./po2json "$po" "$tmp"

  echo "  \"$lang\": {" >> ../translations.js
  sed '1d;$d' "$tmp" | sed 's/^/    /' >> ../translations.js
  echo "  }," >> ../translations.js

  rm "$tmp"
  echo "✅ $lang пераклад дададзены"
done

# выдаляем апошнюю коску
sed -i '$ s/},/}/' ../translations.js
echo "};" >> ../translations.js

echo "🎉 translations.js гатовы: ../translations.js"
