// generates docs

import fs from "fs"
import { task } from "hardhat/config"
import { CompilerOutputContract } from "hardhat/types"

type CompilerOutputContractExtended = CompilerOutputContract & {devdoc: any, userdoc: any}

task("generate-docs")
  .setDescription("generates docs of solidity contracts")
  .setAction(async (_, hre) => {

    // add devdoc and user doc to compilers output
    hre.config.solidity.compilers.forEach(compiler => {
      // @dev, @param, @return
      compiler.settings.outputSelection["*"]["*"].push("devdoc")
      // @notice
      compiler.settings.outputSelection["*"]["*"].push("userdoc")
    })
    await hre.run("compile")

    const contractNames = await hre.artifacts.getAllFullyQualifiedNames();

    // TODO: change to ["^contracts/""] - just using seeded for now
    const only = [
      "^contracts/Versions.sol"
    ]

    const contractPromises = contractNames.map(async contractName => {
      if (only.length && !only.some(m => contractName.match(m))) return

      const [source, name] = contractName.split(':');

      const {abi, devdoc, userdoc} = (
        await hre.artifacts.getBuildInfo(contractName)
      )?.output.contracts[source][name] as CompilerOutputContractExtended

      console.log("USERDOC:", userdoc)
      console.log("USERDOC:", devdoc)

      const getSigType = (input: any) => {
        if(!input.components) input.components = []
        return input.type.replace('tuple', `(${ input.components.map(getSigType).join(',') })`);
      };

      const members = abi.reduce((acc: any, el: any) => {
        // constructor, fallback, and receive do not have names
        let name = el.name || el.type;
        let inputs = el.inputs || [];
        acc[`${ name }(${ inputs.map(getSigType)})`] = el;
        return acc;
      }, {});

      // combine abi members and devdoc
      Object.keys(devdoc.stateVariables || {}).forEach((name) => {
        members[`${ name }()`] = {
          ...devdoc.stateVariables[name],
          ...{type: 'stateVariable'}
        }
      })
      Object.keys(devdoc.events || {}).forEach((sig) => {
        members[sig] = {...devdoc.events[sig], ...members[sig]}
      })
      Object.keys(devdoc.methods || {}).forEach((sig) => {
        members[sig] = {...devdoc.methods[sig], ...members[sig]}
        console.log(members[sig])
      })
      Object.keys(userdoc.events || {}).forEach((sig) => {
        members[sig] = {...userdoc.events[sig], ...members[sig]}
      })
      Object.keys(userdoc.methods || {}).forEach((sig) => {
        members[sig] = {...userdoc.methods[sig], ...members[sig]}
        // console.log(members[sig])
      })

      return {
        name,
        details: devdoc.details,
        members
      }
    })

    const contracts = await Promise.all(contractPromises)
    // turn into markdown

    let pages: any = {}

    contracts.forEach((contract) => {
      if(!contract) return
      let c = "" // content

      c += `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${contract.name} docs</title>
      </head>
      <body>`

      const {members} = contract


      c += `<h1>${contract.name || ''}</h1>`
      c += `<p>${contract.details || ''}</p>`

      if(!members || members.length === 0) return

      for(const m in members){
        c += `<div class="member ${members[m].type}">`
        // console.log(members[m])
        c += `
          <h2 class="member__name">${m}</h2>
          <h3 class="member__type">${members[m].type}</h3>
          <p class="member__notice">${members[m].notice || ""}</p>
          <p class="member__details">${members[m].details || ""}</p>
        `
        // params
        if(members[m].inputs && members[m].inputs.length != 0){
          c += `<h3>Params</h3>
          <table class="member__params-table">
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
  `
          members[m].inputs.forEach( (input: any)=> {
            c += `<tr>
            `
            c += `<td>${input.name}</td>
            `
            c += `<td>${input.internalType}</td>
            `

            if(members[m].params && members[m].params[input.name]){
              c += `<td>${members[m].params[input.name]}</td>
              `
            }
            c += `  </tr>
            `
          })
          c += `</table>
          `
        }

         // returns
         if(members[m].outputs && members[m].outputs.length != 0){
          c += `<h3>Returns</h3>
          <table class="member__returns-table">
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
  `
          members[m].outputs.forEach( (output: any)=> {
            c += `<tr>
            `
            c += `<td>${output.name}</td>
            `
            c += `<td>${output.internalType}</td>
            `

            if(members[m].params && members[m].params[output.name]){
              c += `<td>${members[m].params[output.name]}</td>
              `
            }
            c += `  </tr>
            `
          })
          c += `</table>
          `
        }

        c += `</div>
        `
      }

      c += `</body>
      </html>`

      pages[contract.name] = c

      try{
        fs.mkdir(__dirname + `/docs`, {recursive: true}, (err) => {
          console.error(err)
        })
        fs.writeFileSync(__dirname + `/docs/${contract.name}.html`, c)
      } catch (err) {
        console.error(err)
      }
    })

  })
