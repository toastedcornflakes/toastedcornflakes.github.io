#!/bin/sh
# This is the shittiest code I've written this month. I'm sorry.
# Requirements: 
# pip2? install csscompressor pygments markdown

if hash python2 2>/dev/null; then
	PYTHON=python2
else
	PYTHON=python
fi


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
	(sed "s/page_html_title/$title/g" $header; 
	tail -n +3 $i | 
	# Reduce title number for the generated HTML
	sed "s/^#/##/g" | 
	# Highlight code
	$PYTHON -m markdown -x codehilite -x footnotes;
	cat footer_start.html;
	# Put twitter link+title in the footer
	sed "s/post_tweet_title/$title/g;s/post_tweet_url/https%3A%2F%2Ftoastedcornflakes.github.io%2F$name%2Ehtml/g" footer_addon_articles.html;
	cat $footer
	) > $filename.html
done

# Generate the static pages
(sed -e 's/<h1>page_html_title<\/h1>//g' -e 's/page_html_title/Signals everywhere/g' header.html; $PYTHON -m markdown index.md; cat footer_start.html footer_end.html) > index.html 
(sed 's/page_html_title/About me/' header.html; $PYTHON -m markdown about.md; cat footer_start.html footer_end.html) > about.html 
(sed 's/page_html_title/404 not found/' header.html; $PYTHON -m markdown 404.md; cat footer_start.html footer_end.html) > 404.html 

# generate CSS from templates
cp base_style.css style.css
cp base_style.css articles/style.css
pygmentize -S default -f html >> articles/style.css

# minify the CSS if csscompressor module is installed
if $PYTHON -c 'import csscompressor' 2>/dev/null; then
	$PYTHON -m csscompressor articles/style.css -o articles/style.css
	$PYTHON -m csscompressor style.css -o style.css
fi

if [[ $1 = "--png" ]] || [[ $2 == "--png" ]]; then
	# Compress the pngs in articles/resources/
	command -v optipng >/dev/null 2>&1 && find articles/resources -type f -name "*.png" -exec optipng -o7 {} \;	
fi

if [[ $1 = "--jpg" ]] || [ $2 == "--jpg" ]; then
	# Compress the pngs in articles/resources/
	command -v jpegoptim >/dev/null 2>&1 && find articles/resources -type f -name "*.jpg" -o -name "*.jpeg" -exec jpegoptim -s {} \;	
fi


elapsed=$(($(date +%s)-begin))
echo "Done generating website in $elapsed seconds.\nRunning web server, hit CTRL-C to quit"
echo "Starting HTTP server on port 8000"
$PYTHON -m SimpleHTTPServer &> /dev/null

