# bin bash
mkdir -p ./public

# Copy only the per-chain list.json files; logos are served by the API routes
for list in ../../tokens/[0-9]*/list.json
do
  directory=$(dirname $list)
  mkdir -p ./public/tokens/$(basename $directory)
  cp -f $list ./public/tokens/$(basename $directory)/
done
