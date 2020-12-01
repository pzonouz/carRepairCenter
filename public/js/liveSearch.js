<script>
  $(document).ready(() => {
    $("#customer").keyup(() => {
      $.ajax({
        data: $("#customer").val(),
        type: "POST",
        url: "http://localhost:5000/ajax",
        success: (results, status, xhr) => {
          let duplicated = false;
          for (result of results) {
            let text = result["lastName"] + "-" + result["phoneNumber"];
            for (content of document.getElementById("customerList").children) {
              if (text == content.innerHTML) {
                duplicated = true;
              }
            }
            if (!duplicated) {
              console.log(result["phoneNumber"]);
              let tag =
                '<option value="' +
                result["phoneNumber"] +
                '">' +
                result["lastName"] +
                "-" +
                result["phoneNumber"] +
                "</option>";
              $("#customerList").append(tag);
            }
          }
        },
      });
    });
  });
</script>
