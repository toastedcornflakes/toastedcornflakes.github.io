#!/bin/sh
# This is the shittiest code I've written this month. I'm sorry.
# Requirements: 
# pip install csscompressor pygments  markdown

begin=$(date +%s)
articles=(articles/*.md)
for index in "${!articles[@]}"; do
	i=${articles[$index]}
	filename=$i
	filename="${filename%.*}"
	title=$(head -n 1 $i)
	if [ "$(sed -n 2p $i)" = "latex" ]
	then
		header="header_latex.html"
		footer="footer_end_latex.html"
	else
		header="header.html"
		footer="footer_end.html"
	fi

	echo "[$(($index+1))/${#articles[@]}] Processing $i"
	# Spell check of the md file
	aspell -c $i
	# Please forgive me
	name=$(echo "$filename" | sed -e "s/\//%2F/g")
	(sed "s/page_html_title/$title/g" $header; tail -n +3 $i | sed "s/^#/##/g" | python -m markdown -x codehilite ; cat footer_start.html; sed -e "s/post_tweet_title/$title/g" footer_addon_articles.html | sed -e "s/post_tweet_url/https%3A%2F%2Ftoastedcornflakes.github.io%2F$name%2Ehtml/g"; cat $footer) > $filename.html
done

# Generate the static pages
(sed -e 's/<h1>page_html_title<\/h1>//g' -e 's/page_html_title/Signals everywhere/g' header.html; python -m markdown index.md; cat footer_start.html footer_end.html) > index.html 
(sed 's/page_html_title/About me/' header.html; python -m markdown about.md; cat footer_start.html footer_end.html) > about.html 
(sed 's/page_html_title/404 not found/' header.html; python -m markdown 404.md; cat footer_start.html footer_end.html) > 404.html 

# generate CSS from templates
cp base_style.css style.css
cp base_style.css articles/style.css
pygmentize -S default -f html >> articles/style.css

# minify the CSS if csscompressor module is installed
if python -c 'import csscompressor' 2>/dev/null; then
	python -m csscompressor articles/style.css -o articles/style.css
	python -m csscompressor style.css -o style.css
fi

if [[ $1 = "--png" ]]; then
	# Compress the pngs in articles/resources/
	command -v optipng >/dev/null 2>&1 && find articles/resources/ -type f -name "*.png" -exec optipng -o7 {} \;	
fi


elapsed=$(($(date +%s)-begin))
echo "Done generating website in $elapsed seconds.\nRunning web server, hit CTRL-C to quit"
echo "Starting HTTP server on port 8000"
python -m SimpleHTTPServer &> /dev/null

