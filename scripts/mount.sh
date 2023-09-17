sudo losetup -D
sudo losetup -f .tegra/tegraLoopback.img
sudo mount /dev/loop0p2 .tegra/rootfs
sudo mount -m /dev/loop0p1 .tegra/rootfs/boot
