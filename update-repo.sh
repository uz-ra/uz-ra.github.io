dpkg-scanpackages -m ./debs > Packages
rm Packages.bz2
bzip2 Packages
echo "Updated"