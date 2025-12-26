<script>
    const menuToggle = document.querySelector(".menu-toggle");
    const navLinks = document.querySelector(".nav-links");

    menuToggle.addEventListener("click", () => {
        navLinks.style.display =
            navLinks.style.display === "flex" ? "none" : "flex";
    });
</script>
