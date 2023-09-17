# Bare-minimum profile for a removable drive example
Accomplishes the same as [this builder example](../../builder/removable), but using a profile instead of directly interfacing with ``@tegra/builder``. To quote what is said in the builder examples README:

"The following code creates an bootable UEFI image (intended for flashing to a removable drive) with the rEFInd bootloader, some end-user packages, (``nano``, ``vi``, and ``vim``) and a root account with password ``tegra``. It yields a fully bootable .img, nearly identical to if you followed the [Arch Installation Guide](https://wiki.archlinux.org/title/Installation_guide) all the way through the end and installed the rEFInd bootloader. (does not contain a swap partition)"

*Implementation W.I.P*