const nodemailer = require("nodemailer");

const mailer = async (email, subject, message, username, link, btnText) => {
  const transporter = await nodemailer.createTransport({
    host: "smtp.gmail.com",
    secure: false,
    port: 587,
    auth: {
      user: "wilsonzim566@gmail.com",
      pass: "*zIm-1@#",
    },
    from: "wilsonzim566@gmail.com",
  });

  const mailOptions = {
    from: "<wilsonzim566@gmail.com>",
    to: email,
    subject: subject,
    html: `<h1>Dear ${username}</h1>
              <p>${message}</p>
              <button style="font-size: large; width: 30%; height: 3rem; font-weight: bold; background-color: blue;" ><a href="${link}" style="text-decoration: none; color: white;">${btnText}</a></button>`,
  };

  await transporter.sendMail(mailOptions, (error, info) => {
    if (error) console.log(error);
    else console.log("email sent successfully: " + info.response);
  });
};

module.exports = mailer;
