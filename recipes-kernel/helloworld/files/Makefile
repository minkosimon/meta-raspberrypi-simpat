obj-m := helloworld.o

SRC := $(shell pwd)

# build options
ccflags-y := -DWITH_DYN_ALLOC_MODULE
all:
	$(MAKE) -C $(KERNEL_SRC) M=$(SRC) modules

clean:
	$(MAKE) -C $(KERNEL_SRC) M=$(SRC) clean

modules_install:
	$(MAKE) -C $(KERNEL_SRC) M=$(SRC) modules_install
