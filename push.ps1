git add .
$commitMsg = Read-Host "Commit message"
git commit -m "$commitMsg"
git push
