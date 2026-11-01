export const applicationReportTemplate = async () => {
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application Report</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
    <style>
      body {
        font-family: 'Open Sans', sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f4f4f4;
      }

      .container {
        width: 80%;
        margin: auto;
        overflow: hidden;
      }

      header {
        color: #A0EAC3;
        padding: 30px 0;
        text-align: center;
        border-bottom: 4px solid #A0EAC3;
        position: relative;
      }

      header h1 {
        font-size: 2em;
      }

      main {
        padding: 20px 0;
      }

      main h2 {
        font-size: 1.5em;
        color: #A0EAC3;
      }

      main p {
        font-size: 1.1em;
      }

      footer {
        background: #A0EAC3;
        color: #ffffff;
        text-align: center;
        padding: 10px 0;
      }

      span {
          display: inline-flex,
          cursor: pointer,
        }
        span:hover {
          color: green;
        }
    </style>
  </head>
  <body>
    <div class="container">
      <header>
        <h1>Application Report</h1>
      </header>
      <main>
        <h2>Hi,</h2>
        <p>Please find attached application report</p>
        <br>
        <p>Thanks</p>
        <p>If you have any questions, just reply to this email—we're always happy to help out.</p>
      </main>
      <footer>
        <p>&copy; 2025 Your Company. All rights reserved.</p>
      </footer>
    </div>
  </body>
  </html>

      `;
  return html;
};
