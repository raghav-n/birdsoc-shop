document.getElementById('notifyForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const formData = new FormData(this);

    fetch(this.action, {
        method: 'POST',
        headers: {
            'X-CSRFToken': formData.get('csrfmiddlewaretoken'),
        },
        body: formData,
    })
    .then(response => {
        if (response.ok) {
            document.getElementById('confirmationMessage').style.display = 'block';
            this.reset();
        } else {
            alert('Sorry, something went wrong. Please try again later.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
});