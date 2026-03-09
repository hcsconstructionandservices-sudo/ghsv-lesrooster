./update-media-index.ps1
git add .
$commitMsg = Read-Host "Commit message"
git commit -m "$commitMsg"
git push
